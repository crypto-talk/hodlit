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
import java.time.Duration;
import java.time.Instant;
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
    private final MarketPriceService marketPrices;
    @Value("${cryptalk.asset.publication-max-age:PT1H}")
    private Duration publicationMaxAge = Duration.ofHours(1);
    @Value("${cryptalk.asset.publication-refresh-budget:PT3S}")
    private Duration publicationRefreshBudget = Duration.ofSeconds(3);

    public AssetService(AssetSnapshotRepository snapshots, CoinRepository coins, MemberRepository members,
                        WalletRepository wallets, EthereumBalanceClient ethereum, MarketPriceService marketPrices) {
        this.snapshots = snapshots; this.coins = coins; this.members = members; this.wallets = wallets;
        this.ethereum = ethereum; this.marketPrices = marketPrices;
    }

    @Transactional
    public List<AssetResponse> refreshAndList(Long memberId) {
        return refreshAndList(memberId, false);
    }

    private List<AssetResponse> refreshAndList(Long memberId, boolean publication) {
        long deadline = System.nanoTime() + publicationRefreshBudget.toNanos();
        Member member = members.findById(memberId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        var connectedWallets = wallets.findByMemberIdOrderByCreatedAtAsc(memberId);
        if (connectedWallets.isEmpty()) return List.of();
        Coin eth = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow();
        BigDecimal quantity = BigDecimal.ZERO;
        for (var wallet : connectedWallets) {
            Duration remaining = Duration.ofNanos(deadline - System.nanoTime());
            if (publication && (remaining.isNegative() || remaining.isZero())) {
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "보유 기록 갱신 시간이 초과되었습니다.");
            }
            EthereumBalanceClient.BalanceResult balance = publication
                ? ethereum.balanceOf(wallet.getAddress(), remaining)
                : ethereum.balanceOf(wallet.getAddress());
            if (!"VERIFIED".equals(balance.status()))
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "EVM 지갑 잔액을 모두 확인하지 못했습니다.");
            quantity = quantity.add(balance.quantity());
        }
        AssetSnapshot snapshot = snapshots.findByMemberIdAndCoinId(memberId, eth.getId()).orElseGet(() -> new AssetSnapshot(member, eth));
        BigDecimal value = quantity.signum() == 0 ? BigDecimal.ZERO
            : quantity.multiply(marketPrices.currentPrice(eth, "KRW").price());
        snapshot.capture(quantity, value, quantity.signum() > 0, "VERIFIED", connectedWallets.size());
        snapshots.save(snapshot);
        return snapshots.findByMemberIdOrderByCoinDisplayOrder(memberId).stream().map(this::response).toList();
    }

    @Transactional
    public AssetPortfolioResponse refreshPortfolio(Long memberId) {
        List<AssetResponse> values = refreshAndList(memberId);
        return new AssetPortfolioResponse(wallets.findByMemberIdOrderByCreatedAtAsc(memberId).size(), values);
    }

    @Transactional
    public AssetSnapshot snapshotForPublication(Long memberId, Coin coin) {
        if (coin.getVerificationAvailability() != VerificationAvailability.SUPPORTED) return null;
        if (wallets.findByMemberIdOrderByCreatedAtAsc(memberId).isEmpty()) return null;
        boolean refreshFailed = false;
        try {
            refreshAndList(memberId, true);
        } catch (ApiException exception) {
            if (exception.status() != HttpStatus.SERVICE_UNAVAILABLE) throw exception;
            refreshFailed = true;
        }
        AssetSnapshot snapshot = snapshots.findByMemberIdAndCoinId(memberId, coin.getId()).orElse(null);
        if (snapshot == null) return null;
        Instant now = Instant.now();
        boolean fresh = snapshot.getCapturedAt() != null && !snapshot.getCapturedAt().isAfter(now)
            && !snapshot.getCapturedAt().isBefore(now.minus(publicationMaxAge));
        return snapshot.publicationCopy(fresh, refreshFailed);
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
