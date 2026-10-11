package com.cryptalk.asset;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.VerificationAvailability;
import com.cryptalk.common.ApiException;
import com.cryptalk.exchange.ExchangeConnectionService;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.WalletRepository;
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
    private final AssetSnapshotRepository snapshots;
    private final CoinRepository coins;
    private final MemberRepository members;
    private final WalletRepository wallets;
    private final EthereumBalanceClient ethereum;
    private final PolygonBalanceClient polygon;
    private final MarketPriceService marketPrices;
    private final ExchangeConnectionService exchanges;
    private final AlchemyPortfolioClient alchemy;
    @Value("${cryptalk.asset.publication-max-age:PT1H}")
    private Duration publicationMaxAge = Duration.ofHours(1);
    @Value("${cryptalk.asset.publication-refresh-budget:PT3S}")
    private Duration publicationRefreshBudget = Duration.ofSeconds(3);

    public AssetService(AssetSnapshotRepository snapshots, CoinRepository coins, MemberRepository members,
                        WalletRepository wallets, EthereumBalanceClient ethereum, PolygonBalanceClient polygon, MarketPriceService marketPrices,
                        AlchemyPortfolioClient alchemy, ExchangeConnectionService exchanges) {
        this.snapshots = snapshots;
        this.coins = coins;
        this.members = members;
        this.wallets = wallets;
        this.ethereum = ethereum;
        this.polygon = polygon;
        this.marketPrices = marketPrices;
        this.exchanges = exchanges;
        this.alchemy = alchemy;
    }

    @Transactional
    public List<AssetResponse> refreshAndList(Long memberId) {
        return refreshAndList(memberId, false, null).assets();
    }

    private RefreshResult refreshAndList(Long memberId, boolean publication, String prioritySymbol) {
        long deadline = System.nanoTime() + publicationRefreshBudget.toNanos();
        var member = members.lockById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다."));
        var connectedWallets = wallets.findByMemberIdOrderByCreatedAtAsc(memberId);
        var connections = exchanges.list(memberId);
        if (connectedWallets.isEmpty() && connections.isEmpty()) {
            snapshots.deleteByMemberId(memberId);
            return new RefreshResult(List.of(), emptyWalletPortfolio());
        }

        var nativeCoins = java.util.stream.Stream.of("ETH", "POL")
            .flatMap(symbol -> coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).stream())
            .sorted(java.util.Comparator.comparingInt(coin -> coin.getSymbol().equals(prioritySymbol) ? 0 : 1))
            .toList();
        var discovered = alchemy.isConfigured()
            ? alchemy.fetch(connectedWallets.stream().map(wallet -> wallet.getAddress()).toList(),
                publication ? Duration.ofNanos(Math.max(0, deadline - System.nanoTime())) : Duration.ofSeconds(15))
            : null;
        if (discovered != null) nativeCoins = coins.findByActiveTrueOrderByDisplayOrder().stream()
            .filter(this::walletSupported).toList();
        Map<String, WalletBalance> nativeBalances = new HashMap<>();
        for (var coin : nativeCoins) {
            if (discovered != null) {
                nativeBalances.put(coin.getSymbol(), alchemyBalance(coin, discovered));
                continue;
            }
            BigDecimal quantity = BigDecimal.ZERO;
            boolean complete = true;
            for (var wallet : connectedWallets) {
                Duration remaining = Duration.ofNanos(deadline - System.nanoTime());
                if ("POL".equals(coin.getSymbol())) {
                    var balance = publication ? polygon.balanceOf(wallet.getAddress(), remaining)
                        : polygon.balanceOf(wallet.getAddress());
                    if (!"VERIFIED".equals(balance.status())) complete = false;
                    else quantity = quantity.add(balance.quantity());
                } else {
                    var balance = publication ? ethereum.balanceOf(wallet.getAddress(), remaining)
                        : ethereum.balanceOf(wallet.getAddress());
                    if (!"VERIFIED".equals(balance.status())) complete = false;
                    else quantity = quantity.add(balance.quantity());
                }
            }
            nativeBalances.put(coin.getSymbol(), new WalletBalance(quantity, complete));
        }
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
            ? nativeCoins
            : coins.findByActiveTrueOrderByDisplayOrder();
        for (Coin coin : candidates) {
            String symbol = coin.getSymbol();
            boolean nativeAsset = nativeBalances.containsKey(symbol);
            WalletBalance walletBalance = nativeBalances.getOrDefault(symbol, new WalletBalance(BigDecimal.ZERO, true));
            if (!nativeAsset && coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED
                    && !exchangeQuantities.containsKey(symbol)) continue;
            if (exchangeQuantities.containsKey(symbol) || (discovered != null && nativeAsset)) coin.enableVerification();
            BigDecimal walletAmount = walletBalance.quantity();
            BigDecimal exchangeAmount = exchangeQuantities.getOrDefault(symbol,BigDecimal.ZERO);
            BigDecimal quantity = walletAmount.add(exchangeAmount);
            boolean complete = exchangeComplete && walletBalance.complete();
            if (quantity.compareTo(BigDecimal.TEN.pow(18)) >= 0) {
                quantity = BigDecimal.ZERO;
                complete = false;
            }
            boolean verified = complete && quantity.signum() > 0;
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
            String status = complete ? "VERIFIED" : (discovered == null && !walletBalance.complete() && exchangeComplete ? "RPC_ERROR" : "UNKNOWN");
            snapshot.capture(quantity,value,verified,status,nativeAsset ? connectedWallets.size() : 0);
            snapshot.captureSources(level,connections.size(),sync);
            snapshots.save(snapshot);
        }
        return new RefreshResult(snapshots.findByMemberIdOrderByCoinDisplayOrder(memberId).stream().map(this::response).toList(), discovered);
    }

    @Transactional
    public AssetPortfolioResponse refreshPortfolio(Long memberId) {
        var values = refreshAndList(memberId, false, null);
        return new AssetPortfolioResponse(wallets.findByMemberIdOrderByCreatedAtAsc(memberId).size(),
            exchanges.list(memberId).size(), values.assets(), values.walletAssets());
    }

    @Transactional
    public AssetSnapshot snapshotForPublication(Long memberId,Coin coin) {
        if (coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED
                && !(alchemy.isConfigured() && walletSupported(coin)) && exchanges.list(memberId).isEmpty()) return null;
        boolean refreshFailed = false;
        try {
            refreshAndList(memberId, true, coin.getSymbol());
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
            snapshot.isVerified() ? HoldingQuantityBand.of(snapshot.getCoin().getSymbol(),snapshot.getQuantity()) : null,
            snapshot.isVerified(),snapshot.getVerificationLevel(),snapshot.getVerificationStatus(),snapshot.getWalletCount(),
            snapshot.getHoldingSince(),null,snapshot.getCapturedAt(),snapshot.getBlockNumber(),snapshot.getSyncStatus(),
            snapshot.getHolderStatus(),snapshot.getExchangeCount());
    }


    @Transactional(readOnly = true)
    public AlchemyPortfolioClient.Result walletPortfolio(Long memberId) {
        if (!members.existsById(memberId)) throw new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다.");
        var addresses = wallets.findByMemberIdOrderByCreatedAtAsc(memberId).stream()
            .map(wallet -> wallet.getAddress()).toList();
        if (addresses.isEmpty()) return emptyWalletPortfolio();
        if (!alchemy.isConfigured()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Alchemy API 키를 설정해 주세요.");
        return alchemy.fetch(addresses, Duration.ofSeconds(15));
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
            if (token.rawBalance() == null) { complete = false; continue; }
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
                                         AlchemyPortfolioClient.Result walletAssets) {}
    public record AssetResponse(String symbol,BigDecimal quantity,BigDecimal valueKrw,String quantityBand,
                                boolean verified,String verificationLevel,String status,int walletCount,
                                java.time.Instant holdingSince,Integer holdingMonths,java.time.Instant capturedAt,
                                Long blockNumber,String syncStatus,String holderStatus,int exchangeCount) {}
}
