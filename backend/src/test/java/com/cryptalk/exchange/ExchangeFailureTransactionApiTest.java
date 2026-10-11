package com.cryptalk.exchange;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptalk.asset.AssetSnapshotRepository;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.Coin;
import com.cryptalk.common.ApiException;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "cryptalk.exchange.encryption-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
@AutoConfigureMockMvc
// No test transaction: each HTTP request must actually commit to expose rollback-only failures.
class ExchangeFailureTransactionApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired ExchangeConnectionRepository connections;
    @Autowired ExchangeCredentialCipher cipher;
    @Autowired AssetSnapshotRepository snapshots;
    @Autowired CoinRepository coins;
    @MockitoBean ExchangeBalanceClient balances;
    @MockitoBean MarketPriceService prices;

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void portfolioCommitsUnknownSnapshotWhenExchangeCannotBeChecked(boolean legacy) throws Exception {
        long owner = connect(legacy);
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(Long.toString(owner)))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.exchangeCount").value(1))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.assets[?(@.symbol == 'ETH')].syncStatus").value("PARTIAL"));
        long coinId = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow().getId();
        assertEquals("UNKNOWN", snapshots.findByMemberIdAndCoinId(owner, coinId).orElseThrow().getHolderStatus());
        mvc.perform(get("/api/v1/me/exchanges/upbit/assets")
                .with(jwt().jwt(token -> token.subject(Long.toString(owner)))))
            .andExpect(status().is(legacy ? 503 : 400));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void postAndCommentCommitWithoutFalseHolderClaimWhenExchangeFails(boolean legacy) throws Exception {
        long owner = connect(legacy);
        String response = mvc.perform(post("/api/v1/posts")
                .with(jwt().jwt(token -> token.subject(Long.toString(owner))))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"coinSymbol\":\"ETH\",\"title\":\"title\",\"content\":\"body\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").doesNotExist())
            .andReturn().getResponse().getContentAsString();
        long postId = json.readTree(response).path("id").asLong();
        mvc.perform(post("/api/v1/posts/{id}/comments", postId)
                .with(jwt().jwt(token -> token.subject(Long.toString(owner))))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"reply\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").doesNotExist());
        mvc.perform(get("/api/v1/posts/{id}", postId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("UNKNOWN"));
    }

    private long connect(boolean legacy) {
        when(prices.currentPrice(any(Coin.class), nullable(String.class))).thenAnswer(call ->
            new MarketPriceService.PriceQuote(((Coin) call.getArgument(0)).getSymbol(), BigDecimal.ONE,
                "USD", BigDecimal.ZERO, Instant.now(), "TEST"));
        Member member = members.saveAndFlush(new Member(UUID.randomUUID().toString(), "#123456"));
        var connection = new ExchangeConnection(member, Exchange.UPBIT,
            cipher.encrypt("test-key"), cipher.encrypt("test-secret"));
        if (!legacy) connection.identifyAccount(ExchangeAccountFingerprint.of(Exchange.UPBIT, UUID.randomUUID().toString()));
        connections.saveAndFlush(connection);
        when(balances.balances(any(Exchange.class), anyString(), anyString()))
            .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "expired key"));
        return member.getId();
    }
}
