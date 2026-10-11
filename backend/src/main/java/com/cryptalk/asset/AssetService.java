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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private final MarketPriceService marketPrices;
    private final ExchangeConnectionService exchanges;

    public AssetService(AssetSnapshotRepository snapshots, CoinRepository coins, MemberRepository members,
                        WalletRepository wallets, EthereumBalanceClient ethereum, MarketPriceService marketPrices,
                        ExchangeConnectionService exchanges) {
        this.snapshots = snapshots;
        this.coins = coins;
        this.members = members;
        this.wallets = wallets;
        this.ethereum = ethereum;
        this.marketPrices = marketPrices;
        this.exchanges = exchanges;
    }

    @Transactional
    public List<AssetResponse> refreshAndList(Long memberId) {
        var member = members.lockById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다."));
        var connectedWallets = wallets.findByMemberIdOrderByCreatedAtAsc(memberId);
        var connections = exchanges.list(memberId);
        if (connectedWallets.isEmpty() && connections.isEmpty()) {
            snapshots.deleteByMemberId(memberId);
            return List.of();
        }

        BigDecimal walletQuantity = BigDecimal.ZERO;
        boolean walletComplete = true;
        for (var wallet : connectedWallets) {
            var balance = ethereum.balanceOf(wallet.getAddress());
            if (!"VERIFIED".equals(balance.status())) walletComplete = false;
            else walletQuantity = walletQuantity.add(balance.quantity());
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
            ? List.of(coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow())
            : coins.findByActiveTrueOrderByDisplayOrder();
        for (Coin coin : candidates) {
            String symbol = coin.getSymbol();
            boolean eth = "ETH".equals(symbol);
            if (!eth && coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED
                    && !exchangeQuantities.containsKey(symbol)) continue;
            if (exchangeQuantities.containsKey(symbol)) coin.enableVerification();
            BigDecimal walletAmount = eth ? walletQuantity : BigDecimal.ZERO;
            BigDecimal exchangeAmount = exchangeQuantities.getOrDefault(symbol,BigDecimal.ZERO);
            BigDecimal quantity = walletAmount.add(exchangeAmount);
            boolean complete = exchangeComplete && (!eth || walletComplete);
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
            snapshot.capture(quantity,value,verified,complete ? "VERIFIED" : "UNKNOWN",eth ? connectedWallets.size() : 0);
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
        refreshAndList(memberId); // Server-side balances at publication; published holder rows copy immutable values.
        if (coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED) return null;
        return snapshots.findByMemberIdAndCoinId(memberId,coin.getId()).orElse(null);
    }

    private AssetResponse response(AssetSnapshot snapshot) {
        return new AssetResponse(snapshot.getCoin().getSymbol(),snapshot.getQuantity(),
            "READY".equals(snapshot.getSyncStatus()) ? snapshot.getValueKrw() : null,
            snapshot.isVerified() ? quantityBand(snapshot.getCoin().getSymbol(),snapshot.getQuantity()) : null,
            snapshot.isVerified(),snapshot.getVerificationLevel(),snapshot.getVerificationStatus(),snapshot.getWalletCount(),
            snapshot.getHoldingSince(),null,snapshot.getCapturedAt(),snapshot.getBlockNumber(),snapshot.getSyncStatus(),
            snapshot.getHolderStatus(),snapshot.getExchangeCount());
    }

    private String quantityBand(String symbol,BigDecimal quantity) {
        if (quantity == null || quantity.signum() == 0) return null;
        if (quantity.compareTo(new BigDecimal("0.1")) < 0) return "0~0.1 " + symbol;
        if (quantity.compareTo(BigDecimal.ONE) < 0) return "0.1~1 " + symbol;
        if (quantity.compareTo(BigDecimal.TEN) < 0) return "1~10 " + symbol;
        if (quantity.compareTo(new BigDecimal("100")) < 0) return "10~100 " + symbol;
        return "100+ " + symbol;
    }

    public record AssetPortfolioResponse(int walletCount,int exchangeCount,List<AssetResponse> assets) {}
    public record AssetResponse(String symbol,BigDecimal quantity,BigDecimal valueKrw,String quantityBand,
                                boolean verified,String verificationLevel,String status,int walletCount,
                                java.time.Instant holdingSince,Integer holdingMonths,java.time.Instant capturedAt,
                                Long blockNumber,String syncStatus,String holderStatus,int exchangeCount) {}
}
