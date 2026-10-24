package com.cryptalk.asset;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.coin.Coin;
import com.cryptalk.common.ApiException;
import com.cryptalk.exchange.*;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.Wallet;
import com.cryptalk.wallet.WalletRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "cryptalk.exchange.encryption-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
@AutoConfigureMockMvc
@Transactional
class PartialAssetPublicationApiTest {
    private static final String FIRST = "0x1111111111111111111111111111111111111111";
    private static final String SECOND = "0x2222222222222222222222222222222222222222";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired WalletRepository wallets;
    @Autowired ExchangeConnectionRepository connections;
    @Autowired ExchangeCredentialCipher cipher;
    @MockitoBean AlchemyPortfolioClient alchemy;
    @MockitoBean ExchangeBalanceClient balances;
    @MockitoBean MarketPriceService prices;
    long owner;

    @BeforeEach
    void setup() {
        var member = members.saveAndFlush(new Member(UUID.randomUUID().toString(), "#123456"));
        owner = member.getId();
        wallets.saveAndFlush(new Wallet(member, FIRST));
        wallets.saveAndFlush(new Wallet(member, SECOND));
        var connection = new ExchangeConnection(member, Exchange.UPBIT,
            cipher.encrypt("test-only-key"), cipher.encrypt("test-only-secret"));
        connection.identifyAccount("test-only-account");
        connections.saveAndFlush(connection);
        when(alchemy.isConfigured()).thenReturn(true);
        when(prices.currentPrice(any(Coin.class), nullable(String.class))).thenReturn(
            new MarketPriceService.PriceQuote("ETH", new BigDecimal("1000"), "USD",
                BigDecimal.ZERO, Instant.now(), "TEST"));
    }

    @ParameterizedTest
    @CsvSource({
        "true,false,5,HOLDER,WALLET",
        "false,true,5,HOLDER,EXCHANGE",
        "false,false,5,UNKNOWN,UNVERIFIED",
        "true,false,0,UNKNOWN,UNVERIFIED",
        "false,true,0,UNKNOWN,UNVERIFIED"
    })
    void publicationsUseOnlyConfirmedSubtotals(boolean walletSuccess, boolean exchangeSuccess,
            String amount, String status, String level) throws Exception {
        sources(walletSuccess, exchangeSuccess, amount);
        String body = mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(Long.toString(owner))))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"ETH\",\"title\":\"partial\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.syncStatus").value("PARTIAL"))
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value(status))
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value(level))
            .andExpect(jsonPath("$.verifiedHolder").value("HOLDER".equals(status)))
            .andExpect(jsonPath("$.holderSnapshot.quantityExact").doesNotExist())
            .andReturn().getResponse().getContentAsString();
        long postId = json.readTree(body).path("id").asLong();
        long commentId = json.readTree(mvc.perform(post("/api/v1/posts/{id}/comments", postId)
                .with(jwt().jwt(t -> t.subject(Long.toString(owner))))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"comment\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.syncStatus").value("PARTIAL"))
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value(status))
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value(level))
            .andReturn().getResponse().getContentAsString()).path("id").asLong();
        if ("HOLDER".equals(status)) {
            mvc.perform(get("/api/v1/posts/{id}", postId))
                .andExpect(jsonPath("$.holderSnapshot.quantityBand").value("1~10 ETH"));
            mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(t -> t.subject(Long.toString(owner)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assets[0].symbol").value("ETH"))
                .andExpect(jsonPath("$.assets[0].quantity").value(org.hamcrest.Matchers.closeTo(5.0, 0.000001), Double.class))
                .andExpect(jsonPath("$.unresolvedAssets[?(@.symbol == 'ETH')].holderStatus")
                    .value(org.hamcrest.Matchers.hasItem("HOLDER")));
        } else {
            org.junit.jupiter.api.Assertions.assertTrue(json.readTree(body).path("holderSnapshot").path("quantityBand").isNull());
        }
        // Later refreshes and edits cannot rewrite either publication's frozen proof.
        sources(false, false, "0");
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(t -> t.subject(Long.toString(owner)))))
            .andExpect(status().isOk());
        mvc.perform(get("/api/v1/posts/{id}", postId))
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value(status));
        mvc.perform(patch("/api/v1/comments/{id}", commentId)
                .with(jwt().jwt(t -> t.subject(Long.toString(owner))))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"edited\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value(status));
    }

    @Test
    void missingAlchemyConfigurationDoesNotDiscardSuccessfulExchangeBalance() throws Exception {
        sources(false, true, "5");
        when(alchemy.isConfigured()).thenReturn(false);
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(Long.toString(owner))))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"ETH\",\"title\":\"partial\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("HOLDER"))
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("EXCHANGE"));
    }

    @Test
    void sumsSuccessfulWalletAndExchangeWhileIgnoringAnotherFailedExchange() throws Exception {
        sources(true, true, "2");
        connections.saveAndFlush(new ExchangeConnection(members.findById(owner).orElseThrow(), Exchange.COINONE,
            cipher.encrypt("test-only-second-key"), cipher.encrypt("test-only-second-secret")));
        org.mockito.Mockito.doThrow(new ApiException(HttpStatus.BAD_GATEWAY, "test-only failure"))
            .when(balances).balances(eq(Exchange.COINONE), anyString(), anyString());
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(t -> t.subject(Long.toString(owner)))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[0].quantity").value(org.hamcrest.Matchers.closeTo(4.0, 0.000001), Double.class))
            .andExpect(jsonPath("$.assets[0].verified").value(true))
            .andExpect(jsonPath("$.assets[0].syncStatus").value("PARTIAL"));
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(Long.toString(owner))))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"ETH\",\"title\":\"partial\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("HOLDER"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").value("1~10 ETH"));
    }

    @Test
    void allSuccessfulZeroBalancesStillProduceEmptyStatus() throws Exception {
        sources(true, true, "0");
        when(alchemy.fetch(anyList(), any())).thenReturn(new AlchemyPortfolioClient.Result(List.of(
            new AlchemyPortfolioClient.Token(FIRST, "eth-mainnet", 1, null, "ETH", "Ethereum", 18,
                "0", BigDecimal.ZERO, "READY"),
            new AlchemyPortfolioClient.Token(SECOND, "eth-mainnet", 1, null, "ETH", "Ethereum", 18,
                "0", BigDecimal.ZERO, "READY")), List.of(), true, "READY", Instant.now()));
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(Long.toString(owner))))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"ETH\",\"title\":\"zero\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("EMPTY"))
            .andExpect(jsonPath("$.holderSnapshot.syncStatus").value("READY"))
            .andExpect(jsonPath("$.verifiedHolder").value(false));
    }

    private void sources(boolean walletSuccess, boolean exchangeSuccess, String amount) {
        // The second wallet is always unresolved. Its untrusted positive raw amount must be ignored.
        var first = new AlchemyPortfolioClient.Token(FIRST, "eth-mainnet", 1, null, "ETH", "Ethereum", 18,
            walletSuccess ? new BigDecimal(amount).movePointRight(18).toBigIntegerExact().toString() : null,
            walletSuccess ? new BigDecimal(amount) : null, walletSuccess ? "READY" : "UNKNOWN");
        var second = new AlchemyPortfolioClient.Token(SECOND, "eth-mainnet", 1, null, "ETH", "Ethereum", 18,
            "99000000000000000000", new BigDecimal("99"), "UNKNOWN");
        when(alchemy.fetch(anyList(), any())).thenReturn(new AlchemyPortfolioClient.Result(
            List.of(first, second), List.of("eth-mainnet"), false, "PARTIAL", Instant.now()));
        if (exchangeSuccess) {
            org.mockito.Mockito.doReturn(List.of(
                new ExchangeBalanceClient.Balance("ETH", new BigDecimal(amount), BigDecimal.ZERO, new BigDecimal(amount))))
                .when(balances).balances(any(), anyString(), anyString());
        } else {
            org.mockito.Mockito.doThrow(new ApiException(HttpStatus.BAD_GATEWAY, "test-only upstream failure"))
                .when(balances).balances(any(), anyString(), anyString());
        }
    }
}
