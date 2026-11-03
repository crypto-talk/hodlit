package com.cryptalk.asset;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.VerificationAvailability;
import com.cryptalk.common.ApiException;
import com.cryptalk.exchange.ExchangeConnectionService;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.WalletRepository;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssetService {
    private final com.cryptalk.badge.BadgeService badgeSettings;
    private final AssetSnapshotRepository snapshots;
    private final CoinRepository coins;
    private final MemberRepository members;
    private final WalletRepository wallets;
    private final MarketPriceService marketPrices;
    private final ExchangeConnectionService exchanges;
    private final AlchemyPortfolioClient alchemy;
    @Value("${cryptalk.asset.publication-max-age:PT1H}")
    private Duration publicationMaxAge = Duration.ofHours(1);
    @Value("${cryptalk.asset.publication-refresh-budget:PT3S}")
    private Duration publicationRefreshBudget = Duration.ofSeconds(3);

    public AssetService(AssetSnapshotRepository snapshots, CoinRepository coins, MemberRepository members,
                        WalletRepository wallets, MarketPriceService marketPrices,
                        AlchemyPortfolioClient alchemy, ExchangeConnectionService exchanges, com.cryptalk.badge.BadgeService badgeSettings) {
        this.snapshots = snapshots;
        this.coins = coins;
        this.members = members;
        this.wallets = wallets;
        this.marketPrices = marketPrices;
        this.exchanges = exchanges;
        this.alchemy = alchemy;
        this.badgeSettings = badgeSettings;
    }

    @Transactional
    public List<AssetResponse> refreshAndList(Long memberId) {
        return refreshAndList(memberId, false).assets();
    }

    private RefreshResult refreshAndList(Long memberId, boolean publication) {
        long deadline = System.nanoTime() + publicationRefreshBudget.toNanos();
        var member = members.lockById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다."));
        var connectedWallets = wallets.findByMemberIdOrderByCreatedAtAsc(memberId);
        var connections = exchanges.list(memberId);
        if (connectedWallets.isEmpty() && connections.isEmpty()) {
            snapshots.deleteByMemberId(memberId);
            return new RefreshResult(List.of(), emptyWalletPortfolio());
        }

        if (!publication && !connectedWallets.isEmpty() && !alchemy.isConfigured())
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Alchemy API 키를 설정해 주세요.");
        var discovered = !connectedWallets.isEmpty() && !alchemy.isConfigured()
            ? new AlchemyPortfolioClient.Result(List.of(), AlchemyPortfolioClient.NETWORKS.keySet().stream().sorted().toList(),
                false, "NOT_CONFIGURED", Instant.now())
            : alchemy.fetch(connectedWallets.stream().map(wallet -> wallet.getAddress()).toList(),
                publication ? Duration.ofNanos(Math.max(0, deadline - System.nanoTime())) : Duration.ofSeconds(15));
        var walletCoins = coins.findByActiveTrueOrderByDisplayOrder().stream().filter(this::walletSupported).toList();
        Map<String, WalletBalance> walletBalances = new HashMap<>();
        for (var coin : walletCoins) walletBalances.put(coin.getSymbol(), alchemyBalance(coin, discovered));
        Map<String,BigDecimal> exchangeQuantities = new HashMap<>();
        boolean exchangeComplete = true;
        for (var connection : connections) {
            try {
                var balances = exchanges.assets(memberId,connection.exchange()).balances();
                for (var balance : balances) exchangeQuantities.merge(balance.currency(),balance.total(),BigDecimal::add);
            } catch (ApiException unavailable) {
                // Expired keys, IP restrictions, invalid responses and upstream outages are unknown, never zero.
                exchangeComplete = false;
            }
        }
        var candidates = connections.isEmpty()
            ? walletCoins
            : coins.findByActiveTrueOrderByDisplayOrder();
        for (Coin coin : candidates) {
            String symbol = coin.getSymbol();
            boolean walletAsset = walletBalances.containsKey(symbol);
            WalletBalance walletBalance = walletBalances.getOrDefault(symbol, new WalletBalance(BigDecimal.ZERO, true));
            if (!walletAsset && coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED
                    && !exchangeQuantities.containsKey(symbol)) continue;
            if (exchangeQuantities.containsKey(symbol) || walletAsset) coin.enableVerification();
            BigDecimal walletAmount = walletBalance.quantity();
            BigDecimal exchangeAmount = exchangeQuantities.getOrDefault(symbol,BigDecimal.ZERO);
            BigDecimal quantity = walletAmount.add(exchangeAmount);
            boolean complete = exchangeComplete && walletBalance.complete();
            if (quantity.compareTo(BigDecimal.TEN.pow(18)) >= 0) {
                quantity = BigDecimal.ZERO;
                complete = false;
            }
            // A positive confirmed subtotal proves ownership even when another source failed.
            boolean verified = quantity.signum() > 0;
            String level = verified ? (walletAmount.signum() > 0 ? "WALLET" : "EXCHANGE") : "UNVERIFIED";
            String sync = complete ? "READY" : "PARTIAL";
            BigDecimal value = BigDecimal.ZERO;
            if (quantity.signum() > 0) {
                try { value = quantity.multiply(marketPrices.currentPrice(coin,"KRW").price()); }
                catch (ApiException unavailable) { if (complete) sync = "PRICE_UNAVAILABLE"; }
                if (value.signum() < 0 || value.compareTo(BigDecimal.TEN.pow(22)) >= 0) {
                    value = BigDecimal.ZERO;
                    if (complete) sync = "PRICE_UNAVAILABLE";
                }
            }
            var snapshot = snapshots.findByMemberIdAndCoinId(memberId,coin.getId())
                .orElseGet(() -> new AssetSnapshot(member,coin));
            String status = complete ? "VERIFIED" : "UNKNOWN";
            snapshot.capture(quantity,value,verified,status,walletAsset ? connectedWallets.size() : 0);
            snapshot.captureSources(level,connections.size(),sync);
            snapshots.save(snapshot);
        }
        return new RefreshResult(snapshots.findByMemberIdOrderByCoinDisplayOrder(memberId).stream().map(this::response).toList(), discovered);
    }

    @Transactional
    public AssetPortfolioResponse refreshPortfolio(Long memberId) {
        var values = refreshAndList(memberId, false);
        var held = values.assets().stream().filter(asset -> asset.quantity().signum() > 0).toList();
        var unresolved = values.assets().stream().filter(asset -> "UNKNOWN".equals(asset.holderStatus())
                || "PARTIAL".equals(asset.syncStatus()))
            .map(asset -> new AssetIssueResponse(asset.symbol(), asset.status(), asset.syncStatus(), asset.holderStatus()))
            .toList();
        return new AssetPortfolioResponse(wallets.findByMemberIdOrderByCreatedAtAsc(memberId).size(),
            exchanges.list(memberId).size(), held, unresolved, WalletAssetPortfolioResponse.from(values.walletAssets()));
    }

    @Transactional
    public AssetSnapshot snapshotForPublication(Long memberId,Coin coin) {
        if (coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED
                && !(alchemy.isConfigured() && walletSupported(coin)) && exchanges.list(memberId).isEmpty()) return null;
        boolean refreshFailed = false;
        try {
            refreshAndList(memberId, true);
        } catch (ApiException exception) {
            if (exception.status() != HttpStatus.SERVICE_UNAVAILABLE) throw exception;
            refreshFailed = true;
        }
        if (coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED) return null;
        var snapshot = snapshots.findByMemberIdAndCoinId(memberId,coin.getId()).orElse(null);
        if (snapshot == null) return null;
        Instant now = Instant.now();
        boolean fresh = snapshot.getCapturedAt() != null && !snapshot.getCapturedAt().isAfter(now)
            && !snapshot.getCapturedAt().isBefore(now.minus(publicationMaxAge));
        return snapshot.publicationCopy(fresh, refreshFailed);
    }

    private AssetResponse response(AssetSnapshot snapshot) {
        return new AssetResponse(snapshot.getCoin().getSymbol(),snapshot.getQuantity(),
            "READY".equals(snapshot.getSyncStatus()) ? snapshot.getValueKrw() : null,
            snapshot.isVerified() ? publicationBand(snapshot) : null,
            snapshot.isVerified(),snapshot.getVerificationLevel(),snapshot.getVerificationStatus(),snapshot.getWalletCount(),
            snapshot.getHoldingSince(),null,snapshot.getCapturedAt(),snapshot.getBlockNumber(),snapshot.getSyncStatus(),
            snapshot.getHolderStatus(),snapshot.getExchangeCount());
    }


    @Transactional(readOnly = true)
    public WalletAssetPortfolioResponse walletPortfolio(Long memberId) {
        if (!members.existsById(memberId)) throw new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다.");
        var addresses = wallets.findByMemberIdOrderByCreatedAtAsc(memberId).stream()
            .map(wallet -> wallet.getAddress()).toList();
        if (addresses.isEmpty()) return WalletAssetPortfolioResponse.from(emptyWalletPortfolio());
        if (!alchemy.isConfigured()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Alchemy API 키를 설정해 주세요.");
        return WalletAssetPortfolioResponse.from(alchemy.fetch(addresses, Duration.ofSeconds(15)));
    }

    private AlchemyPortfolioClient.Result emptyWalletPortfolio() {
        return new AlchemyPortfolioClient.Result(List.of(), List.of(), true, "READY", Instant.now());
    }

    private boolean walletSupported(Coin coin) {
        if (coin.getChainId() == null || !AlchemyPortfolioClient.NETWORKS.containsValue(coin.getChainId())
                || coin.getTokenDecimals() == null || coin.getTokenDecimals() < 0 || coin.getTokenDecimals() > 18) return false;
        return ("NATIVE".equals(coin.getAssetType()) && coin.getContractAddress() == null)
            || ("ERC20".equals(coin.getAssetType()) && coin.getContractAddress() != null
                && coin.getContractAddress().matches("0x[0-9a-fA-F]{40}"));
    }

    private WalletBalance alchemyBalance(Coin coin, AlchemyPortfolioClient.Result portfolio) {
        BigDecimal quantity = BigDecimal.ZERO;
        boolean complete = portfolio.completeFor(coin.getChainId());
        for (var token : portfolio.assets()) {
            boolean matches = token.chainId() == coin.getChainId()
                && (coin.getContractAddress() == null ? token.contractAddress() == null
                    : coin.getContractAddress().equalsIgnoreCase(token.contractAddress()));
            if (!matches) continue;
            if (token.rawBalance() == null || !"READY".equals(token.status())) { complete = false; continue; }
            BigDecimal amount = new BigDecimal(new java.math.BigInteger(token.rawBalance()), coin.getTokenDecimals());
            quantity = quantity.add(amount);
        }
        // Database precision is 36/18. Unrepresentable balances cannot become a valid saved proof.
        if (quantity.compareTo(BigDecimal.TEN.pow(18)) >= 0) return new WalletBalance(BigDecimal.ZERO, false);
        return new WalletBalance(quantity, complete);
    }

    private record RefreshResult(List<AssetResponse> assets, AlchemyPortfolioClient.Result walletAssets) {}
    private record WalletBalance(BigDecimal quantity, boolean complete) {}

    public record AssetPortfolioResponse(int walletCount,int exchangeCount,List<AssetResponse> assets,
                                         List<AssetIssueResponse> unresolvedAssets, WalletAssetPortfolioResponse walletAssets) {}
    public record AssetIssueResponse(String symbol, String status, String syncStatus, String holderStatus) {}
    @Schema(description = "성공적으로 확인된 수단의 잔액 합계. PARTIAL에서도 양수 부분합은 verified=true/HOLDER이며 전체 잔액을 의미하지 않습니다.")
    private String publicationBand(AssetSnapshot snapshot) {
        var badge = badgeSettings.capture(snapshot.getCoin(), snapshot);
        return badge == null ? HoldingQuantityBand.of(snapshot.getCoin().getSymbol(), snapshot.getQuantity()) : badge.getQuantityBand();
    }
    public record AssetResponse(String symbol,BigDecimal quantity,BigDecimal valueKrw,String quantityBand,
                                boolean verified,String verificationLevel,String status,int walletCount,
                                java.time.Instant holdingSince,Integer holdingMonths,java.time.Instant capturedAt,
                                Long blockNumber,String syncStatus,String holderStatus,int exchangeCount) {}
}
