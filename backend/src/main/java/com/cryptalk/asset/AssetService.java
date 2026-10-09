package com.cryptalk.asset;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.VerificationAvailability;
import com.cryptalk.common.ApiException;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.WalletRepository;
import java.math.BigDecimal;
import java.util.List;
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

    public AssetService(AssetSnapshotRepository snapshots, CoinRepository coins, MemberRepository members,
                        WalletRepository wallets, EthereumBalanceClient ethereum, MarketPriceService marketPrices) {
        this.snapshots = snapshots; this.coins = coins; this.members = members; this.wallets = wallets;
        this.ethereum = ethereum; this.marketPrices = marketPrices;
    }

    @Transactional
    public List<AssetResponse> refreshAndList(Long memberId) {
        Member member = members.findById(memberId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        var connectedWallets = wallets.findByMemberIdOrderByCreatedAtAsc(memberId);
        if (connectedWallets.isEmpty()) return List.of();
        Coin eth = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow();
        BigDecimal quantity = BigDecimal.ZERO;
        boolean complete = true;
        for (var wallet : connectedWallets) {
            EthereumBalanceClient.BalanceResult balance = ethereum.balanceOf(wallet.getAddress());
            if (!"VERIFIED".equals(balance.status())) {
                complete = false;
                continue;
            }
            quantity = quantity.add(balance.quantity());
        }
        AssetSnapshot snapshot = snapshots.findByMemberIdAndCoinId(memberId, eth.getId()).orElseGet(() -> new AssetSnapshot(member, eth));
        BigDecimal value = BigDecimal.ZERO;
        if (quantity.signum() > 0) {
            try {
                value = quantity.multiply(marketPrices.currentPrice(eth, "KRW").price());
            } catch (ApiException exception) {
                if (exception.status() != HttpStatus.SERVICE_UNAVAILABLE) throw exception;
                complete = false;
            }
        }
        snapshot.capture(quantity, value, complete && quantity.signum() > 0,
            complete ? "VERIFIED" : "RPC_ERROR", connectedWallets.size());
        snapshots.save(snapshot);
        return snapshots.findByMemberIdOrderByCoinDisplayOrder(memberId).stream().map(this::response).toList();
    }

    @Transactional
    public AssetPortfolioResponse refreshPortfolio(Long memberId) {
        List<AssetResponse> values = refreshAndList(memberId);
        return new AssetPortfolioResponse(wallets.findByMemberIdOrderByCreatedAtAsc(memberId).size(), values);
    }

    @Transactional(readOnly = true)
    public AssetSnapshot snapshotForPublication(Long memberId, Coin coin) {
        if (coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED) return null;
        var connected = wallets.findByMemberIdOrderByCreatedAtAsc(memberId);
        if (connected.isEmpty()) return null;
        return snapshots.findByMemberIdAndCoinId(memberId, coin.getId()).orElseGet(() -> {
            AssetSnapshot unknown = new AssetSnapshot(members.findById(memberId).orElseThrow(), coin);
            unknown.capture(BigDecimal.ZERO, BigDecimal.ZERO, false, "UNKNOWN", connected.size());
            return unknown;
        });
    }

    private AssetResponse response(AssetSnapshot snapshot) {
        return new AssetResponse(snapshot.getCoin().getSymbol(), snapshot.getQuantity(), snapshot.getValueKrw(),
            quantityBand(snapshot.getCoin().getSymbol(), snapshot.getQuantity()), snapshot.isVerified(),
            snapshot.isVerified() ? "WALLET" : "UNVERIFIED", snapshot.getVerificationStatus(),
            snapshot.getWalletCount(), snapshot.getHoldingSince(), null, snapshot.getCapturedAt(),
            snapshot.getBlockNumber(), snapshot.getSyncStatus());
    }

    private String quantityBand(String symbol, BigDecimal quantity) {
        if (quantity == null || quantity.signum() == 0) return null;
        if (quantity.compareTo(new BigDecimal("0.1")) < 0) return "0~0.1 " + symbol;
        if (quantity.compareTo(BigDecimal.ONE) < 0) return "0.1~1 " + symbol;
        if (quantity.compareTo(BigDecimal.TEN) < 0) return "1~10 " + symbol;
        if (quantity.compareTo(new BigDecimal("100")) < 0) return "10~100 " + symbol;
        return "100+ " + symbol;
    }

    public record AssetPortfolioResponse(int walletCount, List<AssetResponse> assets) {}
    public record AssetResponse(String symbol, BigDecimal quantity, BigDecimal valueKrw, String quantityBand,
                                boolean verified, String verificationLevel, String status, int walletCount,
                                java.time.Instant holdingSince, Integer holdingMonths, java.time.Instant capturedAt,
                                Long blockNumber, String syncStatus) {}
}
