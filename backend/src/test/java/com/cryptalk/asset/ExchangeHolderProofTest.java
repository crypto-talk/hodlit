package com.cryptalk.asset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.VerificationAvailability;
import com.cryptalk.common.ApiException;
import com.cryptalk.exchange.Exchange;
import com.cryptalk.exchange.ExchangeBalanceClient;
import com.cryptalk.exchange.ExchangeConnectionService;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.post.Post;
import com.cryptalk.post.PostHolderSnapshot;
import com.cryptalk.wallet.Wallet;
import com.cryptalk.wallet.WalletRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ExchangeHolderProofTest {
    @Test
    void zeroWalletAndFiveExchangeEthUseExchangeLevelAndImmutableBand() {
        var f = new Fixture();
        f.exchange("ETH",new BigDecimal("5"));
        var asset = f.service.refreshAndList(7L).getFirst();
        assertTrue(asset.verified());
        assertEquals("EXCHANGE",asset.verificationLevel());
        assertEquals("HOLDER",asset.holderStatus());
        assertEquals("1~10 ETH",asset.quantityBand());
        Post post = mock(Post.class);
        when(post.getCoin()).thenReturn(f.eth);
        var published = new PostHolderSnapshot(post,f.ethSnapshot);
        f.ethSnapshot.capture(BigDecimal.ZERO,BigDecimal.ZERO,false,"UNKNOWN",1);
        assertEquals("EXCHANGE",published.getVerificationLevel());
        assertEquals("HOLDER",published.getHolderStatus());
        assertEquals("1~10 ETH",published.getQuantityBand());
    }

    @Test
    void positiveWalletIsStrongerAndQuantitiesAreAdded() {
        var f = new Fixture();
        when(f.ethereum.balanceOf("wallet")).thenReturn(new EthereumBalanceClient.BalanceResult(new BigDecimal("2"),"VERIFIED"));
        f.exchange("ETH",new BigDecimal("5"));
        var asset = f.service.refreshAndList(7L).getFirst();
        assertEquals(0,new BigDecimal("7").compareTo(asset.quantity()));
        assertEquals("WALLET",asset.verificationLevel());
    }

    @Test
    void anyFailedEligibleSourceIsUnknownEvenWithPositiveOtherHoldings() {
        var f = new Fixture();
        f.exchange("ETH",new BigDecimal("5"));
        when(f.ethereum.balanceOf("wallet")).thenReturn(new EthereumBalanceClient.BalanceResult(BigDecimal.ZERO,"RPC_ERROR"));
        var asset = f.service.refreshAndList(7L).getFirst();
        assertFalse(asset.verified());
        assertEquals("UNKNOWN",asset.holderStatus());
        assertEquals("PARTIAL",asset.syncStatus());
        assertNull(asset.quantityBand());
        assertNull(asset.valueKrw());
    }

    @Test
    void emptyRequiresAllSuccessfulAndExpiredExchangeBecomesUnknown() {
        var f = new Fixture();
        f.exchange("ETH",BigDecimal.ZERO);
        assertEquals("EMPTY",f.service.refreshAndList(7L).getFirst().holderStatus());
        when(f.exchanges.assets(7L,Exchange.UPBIT)).thenThrow(new ApiException(HttpStatus.BAD_REQUEST,"expired key"));
        assertEquals("UNKNOWN",f.service.refreshAndList(7L).getFirst().holderStatus());
    }

    @Test
    void exchangeOnlyBitcoinCanBeVerifiedWithoutEvmWallets() {
        var f = new Fixture();
        when(f.wallets.findByMemberIdOrderByCreatedAtAsc(7L)).thenReturn(List.of());
        f.exchange("BTC",new BigDecimal("3"));
        when(f.snapshots.findByMemberIdOrderByCoinDisplayOrder(7L)).thenReturn(List.of(f.btcSnapshot,f.ethSnapshot));
        var asset = f.service.refreshAndList(7L).getFirst();
        assertEquals("BTC",asset.symbol());
        assertEquals("EXCHANGE",asset.verificationLevel());
        assertEquals("HOLDER",asset.holderStatus());
        assertEquals(0,asset.walletCount());
        assertEquals(1,asset.exchangeCount());
    }

    @Test
    void noConnectionsDeletePrivateCache() {
        var f = new Fixture();
        when(f.wallets.findByMemberIdOrderByCreatedAtAsc(7L)).thenReturn(List.of());
        assertTrue(f.service.refreshAndList(7L).isEmpty());
        verify(f.snapshots).deleteByMemberId(7L);
    }

    private static class Fixture {
        final AssetSnapshotRepository snapshots = mock(AssetSnapshotRepository.class);
        final CoinRepository coins = mock(CoinRepository.class);
        final MemberRepository members = mock(MemberRepository.class);
        final WalletRepository wallets = mock(WalletRepository.class);
        final EthereumBalanceClient ethereum = mock(EthereumBalanceClient.class);
        final MarketPriceService prices = mock(MarketPriceService.class);
        final ExchangeConnectionService exchanges = mock(ExchangeConnectionService.class);
        final Member member = mock(Member.class);
        final Coin eth = coin(2L,"ETH");
        final Coin btc = coin(1L,"BTC");
        final AssetSnapshot ethSnapshot = new AssetSnapshot(member,eth);
        final AssetSnapshot btcSnapshot = new AssetSnapshot(member,btc);
        final AssetService service = new AssetService(snapshots,coins,members,wallets,ethereum,prices,exchanges);
        Fixture() {
            when(members.lockById(7L)).thenReturn(Optional.of(member));
            Wallet wallet = mock(Wallet.class);
            when(wallet.getAddress()).thenReturn("wallet");
            when(wallets.findByMemberIdOrderByCreatedAtAsc(7L)).thenReturn(List.of(wallet));
            when(ethereum.balanceOf("wallet")).thenReturn(new EthereumBalanceClient.BalanceResult(BigDecimal.ZERO,"VERIFIED"));
            when(coins.findBySymbolIgnoreCaseAndActiveTrue("ETH")).thenReturn(Optional.of(eth));
            when(coins.findByActiveTrueOrderByDisplayOrder()).thenReturn(List.of(btc,eth));
            when(snapshots.findByMemberIdAndCoinId(7L,2L)).thenReturn(Optional.of(ethSnapshot));
            when(snapshots.findByMemberIdAndCoinId(7L,1L)).thenReturn(Optional.of(btcSnapshot));
            when(snapshots.findByMemberIdOrderByCoinDisplayOrder(7L)).thenReturn(List.of(ethSnapshot));
            when(prices.currentPrice(any(Coin.class),eq("KRW"))).thenReturn(
                new MarketPriceService.PriceQuote("ETH",new BigDecimal("1000"),"KRW",BigDecimal.ZERO,Instant.now(),"TEST"));
        }
        void exchange(String symbol,BigDecimal amount) {
            when(exchanges.list(7L)).thenReturn(List.of(new ExchangeConnectionService.ConnectionResponse(Exchange.UPBIT,Instant.now())));
            when(exchanges.assets(7L,Exchange.UPBIT)).thenReturn(new ExchangeConnectionService.AssetResponse(Exchange.UPBIT,
                List.of(new ExchangeBalanceClient.Balance(symbol,amount,BigDecimal.ZERO,amount)),Instant.now()));
        }
        static Coin coin(Long id,String symbol) {
            var coin = mock(Coin.class);
            when(coin.getId()).thenReturn(id);
            when(coin.getSymbol()).thenReturn(symbol);
            when(coin.getVerificationAvailability()).thenReturn(VerificationAvailability.SUPPORTED);
            return coin;
        }
    }
}
