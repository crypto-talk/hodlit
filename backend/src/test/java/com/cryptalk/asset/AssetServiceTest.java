package com.cryptalk.asset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.junit.jupiter.api.Assertions.assertNull;
import com.cryptalk.coin.VerificationAvailability;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.market.MarketPriceService.PriceQuote;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.Wallet;
import com.cryptalk.wallet.WalletRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Duration;
import com.cryptalk.coin.VerificationAvailability;
import static org.mockito.ArgumentMatchers.any;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AssetServiceTest {
    @Test
    void staleCachedBalanceCannotVerifyPublicationAndTheCacheIsNotRewritten() {
        AssetSnapshotRepository snapshots = mock(AssetSnapshotRepository.class);
        CoinRepository coins = mock(CoinRepository.class);
        MemberRepository members = mock(MemberRepository.class);
        WalletRepository wallets = mock(WalletRepository.class);
        AlchemyPortfolioClient alchemy = mock(AlchemyPortfolioClient.class);
        MarketPriceService prices = mock(MarketPriceService.class);
        Member member = mock(Member.class);
        Coin eth = mock(Coin.class);
        Wallet wallet = mock(Wallet.class);
        when(members.lockById(7L)).thenThrow(new com.cryptalk.common.ApiException(
            org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "temporarily unavailable"));
        when(wallets.findByMemberIdOrderByCreatedAtAsc(7L)).thenReturn(List.of(wallet));
        when(wallet.getAddress()).thenReturn("0x1111111111111111111111111111111111111111");
        when(coins.findBySymbolIgnoreCaseAndActiveTrue("ETH")).thenReturn(Optional.of(eth));
        when(eth.getId()).thenReturn(2L);
        when(eth.getVerificationAvailability()).thenReturn(VerificationAvailability.SUPPORTED);
        AssetSnapshot cached = new AssetSnapshot(member, eth);
        cached.capture(BigDecimal.TEN, BigDecimal.TEN, true, "VERIFIED", 1);
        ReflectionTestUtils.setField(cached, "capturedAt", Instant.now().minus(Duration.ofHours(2)));
        when(snapshots.findByMemberIdAndCoinId(7L, 2L)).thenReturn(Optional.of(cached));
        AssetSnapshot published = new AssetService(snapshots, coins, members, wallets, prices, alchemy, mock(com.cryptalk.exchange.ExchangeConnectionService.class), mock(com.cryptalk.badge.BadgeService.class))
            .snapshotForPublication(7L, eth);
        assertFalse(published.isVerified());
        assertEquals("STALE", published.getSyncStatus());
        assertEquals(0, BigDecimal.ZERO.compareTo(published.getQuantity()));
        assertTrue(cached.isVerified());
        assertEquals(0, BigDecimal.TEN.compareTo(cached.getQuantity()));
    }

    @Test
    void aggregatesVerifiedEthAcrossConnectedEvmWallets() {
        AssetSnapshotRepository snapshots = mock(AssetSnapshotRepository.class);
        CoinRepository coins = mock(CoinRepository.class);
        MemberRepository members = mock(MemberRepository.class);
        WalletRepository wallets = mock(WalletRepository.class);
        AlchemyPortfolioClient alchemy = mock(AlchemyPortfolioClient.class);
        MarketPriceService marketPrices = mock(MarketPriceService.class);
        Member member = mock(Member.class);
        Wallet wallet = mock(Wallet.class);
        Wallet secondWallet = mock(Wallet.class);
        Coin eth = mock(Coin.class);
        AssetSnapshot snapshot = new AssetSnapshot(member, eth);

        when(members.lockById(7L)).thenReturn(Optional.of(member));
        when(wallets.findByMemberIdOrderByCreatedAtAsc(7L)).thenReturn(List.of(wallet, secondWallet));
        when(wallet.getAddress()).thenReturn("0x1111111111111111111111111111111111111111");
        when(secondWallet.getAddress()).thenReturn("0x2222222222222222222222222222222222222222");
        when(coins.findBySymbolIgnoreCaseAndActiveTrue("ETH")).thenReturn(Optional.of(eth));
        when(eth.getId()).thenReturn(2L);
        when(eth.getSymbol()).thenReturn("ETH");
        when(alchemy.isConfigured()).thenReturn(true);
        when(eth.getChainId()).thenReturn(1L);
        when(eth.getAssetType()).thenReturn("NATIVE");
        when(eth.getTokenDecimals()).thenReturn(18);
        when(coins.findByActiveTrueOrderByDisplayOrder()).thenReturn(List.of(eth));
        when(alchemy.fetch(org.mockito.ArgumentMatchers.anyList(), any(Duration.class))).thenReturn(
            new AlchemyPortfolioClient.Result(List.of(
                new AlchemyPortfolioClient.Token("0x1111111111111111111111111111111111111111", "eth-mainnet", 1, null, "ETH", "Ethereum", 18,
                    "2000000000000000000", new BigDecimal("2"), "READY"),
                new AlchemyPortfolioClient.Token("0x2222222222222222222222222222222222222222", "eth-mainnet", 1, null, "ETH", "Ethereum", 18,
                    "3000000000000000000", new BigDecimal("3"), "READY")), List.of(), true, "READY", Instant.now()));
        when(marketPrices.currentPrice(eth, "KRW")).thenReturn(new PriceQuote("ETH", new BigDecimal("3242542"),
            "KRW", new BigDecimal("-3.45"), Instant.parse("2026-09-02T12:49:50Z"), "COINGECKO"));
        when(snapshots.findByMemberIdAndCoinId(7L, 2L)).thenReturn(Optional.of(snapshot));
        when(snapshots.findByMemberIdOrderByCoinDisplayOrder(7L)).thenReturn(List.of(snapshot));
        AssetService service = new AssetService(snapshots, coins, members, wallets, marketPrices, alchemy, mock(com.cryptalk.exchange.ExchangeConnectionService.class), mock(com.cryptalk.badge.BadgeService.class));

        AssetService.AssetResponse asset = service.refreshAndList(7L).get(0);

        assertEquals(0, new BigDecimal("16212710").compareTo(asset.valueKrw()));
        assertEquals("VERIFIED", asset.status());
        assertEquals("1~10 ETH", asset.quantityBand());
        assertEquals(2, asset.walletCount());
    }
}
