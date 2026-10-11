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
    @Value("${cryptalk.asset.publication-max-age:PT1H}")
    private Duration publicationMaxAge = Duration.ofHours(1);
    @Value("${cryptalk.asset.publication-refresh-budget:PT3S}")
    private Duration publicationRefreshBudget = Duration.ofSeconds(3);

    public AssetService(AssetSnapshotRepository snapshots, CoinRepository coins, MemberRepository members,
                        WalletRepository wallets, EthereumBalanceClient ethereum, PolygonBalanceClient polygon, MarketPriceService marketPrices,
                        ExchangeConnectionService exchanges) {
        this.snapshots = snapshots;
        this.coins = coins;
        this.members = members;
        this.wallets = wallets;
        this.ethereum = ethereum;
        this.polygon = polygon;
        this.marketPrices = marketPrices;
        this.exchanges = exchanges;
    }

    @Transactional
    public List<AssetResponse> refreshAndList(Long memberId) {
        return refreshAndList(memberId, false, null);
    }

    private List<AssetResponse> refreshAndList(Long memberId, boolean publication, String prioritySymbol) {
        long deadline = System.nanoTime() + publicationRefreshBudget.toNanos();
        var member = members.lockById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다."));
        var connectedWallets = wallets.findByMemberIdOrderByCreatedAtAsc(memberId);
        var connections = exchanges.list(memberId);
        if (connectedWallets.isEmpty() && connections.isEmpty()) {
            snapshots.deleteByMemberId(memberId);
            return List.of();
        }

        var nativeCoins = java.util.stream.Stream.of("ETH", "POL")
            .flatMap(symbol -> coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).stream())
            .sorted(java.util.Comparator.comparingInt(coin -> coin.getSymbol().equals(prioritySymbol) ? 0 : 1))
            .toList();
        Map<String, WalletBalance> nativeBalances = new HashMap<>();
        for (var coin : nativeCoins) {
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
            if (exchangeQuantities.containsKey(symbol)) coin.enableVerification();
            BigDecimal walletAmount = walletBalance.quantity();
            BigDecimal exchangeAmount = exchangeQuantities.getOrDefault(symbol,BigDecimal.ZERO);
            BigDecimal quantity = walletAmount.add(exchangeAmount);
            boolean complete = exchangeComplete && walletBalance.complete();
            boolean verified = complete && quantity.signum() > 0;
            String level = verified ? (walletAmount.signum() > 0 ? "WALLET" : "EXCHANGE") : "UNVERIFIED";
            String sync = complete ? "READY" : "PARTIAL";
            BigDecimal value = BigDecimal.ZERO;
            if (quantity.signum() > 0) {
                try { value = quantity.multiply(marketPrices.currentPrice(coin,"KRW").price()); }
                catch (ApiException unavailable) { if (complete) sync = "PRICE_UNAVAILABLE"; }
            }
            var snapshot = snapshots.findByMemberIdAndCoinId(memberId,coin.getId())
                .orElseGet(() -> new AssetSnapshot(member,coin));
            String status = complete ? "VERIFIED" : (!walletBalance.complete() && exchangeComplete ? "RPC_ERROR" : "UNKNOWN");
            snapshot.capture(quantity,value,verified,status,nativeAsset ? connectedWallets.size() : 0);
            snapshot.captureSources(level,connections.size(),sync);
            snapshots.save(snapshot);
        }
        return snapshots.findByMemberIdOrderByCoinDisplayOrder(memberId).stream().map(this::response).toList();
    }

    @Transactional
    public AssetPortfolioResponse refreshPortfolio(Long memberId) {
        var values = refreshAndList(memberId);
        return new AssetPortfolioResponse(wallets.findByMemberIdOrderByCreatedAtAsc(memberId).size(),
            exchanges.list(memberId).size(),values);
    }

    @Transactional
    public AssetSnapshot snapshotForPublication(Long memberId,Coin coin) {
        if (coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED && exchanges.list(memberId).isEmpty()) return null;
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


    private record WalletBalance(BigDecimal quantity, boolean complete) {}

    public record AssetPortfolioResponse(int walletCount,int exchangeCount,List<AssetResponse> assets) {}
    public record AssetResponse(String symbol,BigDecimal quantity,BigDecimal valueKrw,String quantityBand,
                                boolean verified,String verificationLevel,String status,int walletCount,
                                java.time.Instant holdingSince,Integer holdingMonths,java.time.Instant capturedAt,
                                Long blockNumber,String syncStatus,String holderStatus,int exchangeCount) {}
}
