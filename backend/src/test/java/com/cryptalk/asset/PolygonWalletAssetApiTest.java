package com.cryptalk.asset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.Wallet;
import com.cryptalk.wallet.WalletRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PolygonWalletAssetApiTest {
    @Autowired MockMvc mvc;
    @Autowired MemberRepository members;
    @Autowired WalletRepository wallets;
    @Autowired CoinRepository coins;
    @MockitoBean EthereumBalanceClient ethereum;
    @MockitoBean PolygonBalanceClient polygon;
    @MockitoBean MarketPriceService prices;
    Member owner;

    @BeforeEach
    void setup() {
        owner = members.saveAndFlush(new Member(UUID.randomUUID().toString(), "#123456"));
        wallets.saveAndFlush(new Wallet(owner, "0x" + UUID.randomUUID().toString().replace("-", "") + "12345678"));
        when(ethereum.balanceOf(anyString())).thenReturn(new EthereumBalanceClient.BalanceResult(BigDecimal.ZERO, "VERIFIED"));
        when(ethereum.balanceOf(anyString(), any(Duration.class)))
            .thenReturn(new EthereumBalanceClient.BalanceResult(BigDecimal.ZERO, "VERIFIED"));
        when(polygon.balanceOf(anyString())).thenReturn(new PolygonBalanceClient.BalanceResult(new BigDecimal("3.5"), "VERIFIED"));
        when(polygon.balanceOf(anyString(), any(Duration.class)))
            .thenReturn(new PolygonBalanceClient.BalanceResult(new BigDecimal("3.5"), "VERIFIED"));
        when(prices.currentPrice(any(Coin.class), nullable(String.class))).thenAnswer(call ->
            new MarketPriceService.PriceQuote(((Coin) call.getArgument(0)).getSymbol(), BigDecimal.TEN,
                "KRW", BigDecimal.ZERO, Instant.now(), "TEST"));
    }

    @Test
    void connectedWalletIncludesPolygonNativeBalanceAndPublishesWalletProof() throws Exception {
        Coin pol = coins.findBySymbolIgnoreCaseAndActiveTrue("POL").orElseThrow();
        assertEquals(137L, pol.getChainId());
        assertEquals("NATIVE", pol.getAssetType());
        assertEquals(18, pol.getTokenDecimals());
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.exchangeCount").value(0))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].quantity").value(3.5))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].walletCount").value(1))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].verificationLevel").value("WALLET"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].holderStatus").value("HOLDER"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].holderStatus").value("EMPTY"));
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(token -> token.subject(owner.getId().toString())))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"POL\",\"title\":\"polygon\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("WALLET"))
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("HOLDER"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").value("1~10 POL"));
        var order = inOrder(polygon, ethereum);
        order.verify(polygon).balanceOf(anyString(), any(Duration.class));
        order.verify(ethereum).balanceOf(anyString(), any(Duration.class));
    }

    @Test
    void ethereumRpcFailureDoesNotInvalidatePolygonWalletHoldings() throws Exception {
        when(ethereum.balanceOf(anyString())).thenReturn(new EthereumBalanceClient.BalanceResult(BigDecimal.ZERO, "RPC_ERROR"));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].holderStatus").value("HOLDER"));
    }

    @Test
    void polygonRpcFailureDoesNotBecomeEmptyOrInvalidateEthereum() throws Exception {
        when(ethereum.balanceOf(anyString())).thenReturn(new EthereumBalanceClient.BalanceResult(BigDecimal.ONE, "VERIFIED"));
        when(polygon.balanceOf(anyString())).thenReturn(new PolygonBalanceClient.BalanceResult(BigDecimal.ZERO, "RPC_ERROR"));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].syncStatus").value("PARTIAL"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].holderStatus").value("HOLDER"));
    }

    @Test
    void verifiedZeroPolygonBalanceIsEmpty() throws Exception {
        when(polygon.balanceOf(anyString())).thenReturn(new PolygonBalanceClient.BalanceResult(BigDecimal.ZERO, "VERIFIED"));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].holderStatus").value("EMPTY"));
    }

    @Test
    void aggregatesPolygonBalancesAcrossWallets() throws Exception {
        wallets.saveAndFlush(new Wallet(owner, "0x" + UUID.randomUUID().toString().replace("-", "") + "87654321"));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(owner.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].quantity").value(7.0))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'POL')].walletCount").value(2));
    }
}
