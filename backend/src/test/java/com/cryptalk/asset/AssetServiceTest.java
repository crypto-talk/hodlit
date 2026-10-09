package com.cryptalk.asset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AssetServiceTest {
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void aggregatesSuccessfulBalancesButNeverVerifiesPartialFailure(boolean partialFailure) {
        AssetSnapshotRepository snapshots = mock(AssetSnapshotRepository.class);
        CoinRepository coins = mock(CoinRepository.class);
        MemberRepository members = mock(MemberRepository.class);
        WalletRepository wallets = mock(WalletRepository.class);
        EthereumBalanceClient ethereum = mock(EthereumBalanceClient.class);
        MarketPriceService marketPrices = mock(MarketPriceService.class);
        Member member = mock(Member.class);
        Wallet wallet = mock(Wallet.class);
        Wallet secondWallet = mock(Wallet.class);
        Coin eth = mock(Coin.class);
        AssetSnapshot snapshot = new AssetSnapshot(member, eth);

        when(members.findById(7L)).thenReturn(Optional.of(member));
        when(wallets.findByMemberIdOrderByCreatedAtAsc(7L)).thenReturn(List.of(wallet, secondWallet));
        when(wallet.getAddress()).thenReturn("0x1111111111111111111111111111111111111111");
        when(secondWallet.getAddress()).thenReturn("0x2222222222222222222222222222222222222222");
        when(coins.findBySymbolIgnoreCaseAndActiveTrue("ETH")).thenReturn(Optional.of(eth));
        when(eth.getId()).thenReturn(2L);
        when(eth.getSymbol()).thenReturn("ETH");
        when(ethereum.balanceOf(wallet.getAddress()))
            .thenReturn(new EthereumBalanceClient.BalanceResult(new BigDecimal("2"), "VERIFIED"));
        when(ethereum.balanceOf(secondWallet.getAddress()))
            .thenReturn(new EthereumBalanceClient.BalanceResult(new BigDecimal("3"), partialFailure ? "RPC_ERROR" : "VERIFIED"));
        when(marketPrices.currentPrice(eth, "KRW")).thenReturn(new PriceQuote("ETH", new BigDecimal("3242542"),
            "KRW", new BigDecimal("-3.45"), Instant.parse("2026-09-02T12:49:50Z"), "COINGECKO"));
        when(snapshots.findByMemberIdAndCoinId(7L, 2L)).thenReturn(Optional.of(snapshot));
        when(snapshots.findByMemberIdOrderByCoinDisplayOrder(7L)).thenReturn(List.of(snapshot));
        AssetService service = new AssetService(snapshots, coins, members, wallets, ethereum, marketPrices);

        AssetService.AssetResponse asset = service.refreshAndList(7L).get(0);

        assertEquals(0, new BigDecimal(partialFailure ? "6485084" : "16212710").compareTo(asset.valueKrw()));
        assertEquals(partialFailure ? "RPC_ERROR" : "VERIFIED", asset.status());
        assertEquals(!partialFailure, asset.verified());
        assertEquals(partialFailure ? "UNKNOWN" : "HOLDER", snapshot.getHolderStatus());
        assertEquals("1~10 ETH", asset.quantityBand());
        assertEquals(2, asset.walletCount());
    }
}
