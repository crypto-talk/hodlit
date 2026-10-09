package com.cryptalk.exchange;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.cryptalk.asset.AssetSnapshotRepository;
import com.cryptalk.coin.Coin;
import com.cryptalk.common.ApiException;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties="cryptalk.exchange.encryption-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
@AutoConfigureMockMvc
@Transactional
class ExchangeHolderPublicationApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired ExchangeConnectionRepository connections;
    @Autowired ExchangeCredentialCipher cipher;
    @Autowired AssetSnapshotRepository snapshots;
    @MockitoBean ExchangeBalanceClient balances;
    @MockitoBean MarketPriceService prices;
    long owner;
    String key;
    String credentials;

    @BeforeEach
    void setup() {
        owner = members.saveAndFlush(new Member(UUID.randomUUID().toString(),"#123456")).getId();
        key = "test-only-" + UUID.randomUUID();
        credentials = "{\"accessKey\":\""+key+"\",\"secretKey\":\"test-only-secret\"}";
        when(balances.balances(any(Exchange.class),anyString(),anyString())).thenReturn(eth("5"));
        when(prices.currentPrice(any(Coin.class),nullable(String.class))).thenAnswer(call ->
            new MarketPriceService.PriceQuote(((Coin)call.getArgument(0)).getSymbol(),new BigDecimal("1000"),
                call.getArgument(1)==null ? "USD" : call.getArgument(1),BigDecimal.ZERO,Instant.now(),"TEST"));
    }

    @Test
    void publicationIncludesExchangeButNeverExactQuantityAndSurvivesDisconnection() throws Exception {
        connect(owner);
        JsonNode post = publish();
        org.junit.jupiter.api.Assertions.assertTrue(post.path("assetValueKrw").isNull());
        long id = post.path("id").asLong();
        mvc.perform(post("/api/v1/posts/{id}/comments",id).with(jwt().jwt(token -> token.subject(Long.toString(owner))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"comment\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("EXCHANGE"))
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("HOLDER"));
        when(balances.balances(any(Exchange.class),anyString(),anyString())).thenReturn(eth("10"));
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(token -> token.subject(Long.toString(owner)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.exchangeCount").value(1));
        mvc.perform(delete("/api/v1/me/exchanges/upbit").with(jwt().jwt(token -> token.subject(Long.toString(owner)))))
            .andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertTrue(snapshots.findByMemberIdOrderByCoinDisplayOrder(owner).isEmpty());
        mvc.perform(get("/api/v1/posts/{id}",id))
            .andExpect(status().isOk()).andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("EXCHANGE"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").value("1~10 ETH"))
            .andExpect(jsonPath("$.holderSnapshot.quantityExact").doesNotExist());
        var unlinked = publish();
        org.junit.jupiter.api.Assertions.assertEquals("NOT_CONNECTED",unlinked.path("holderSnapshot").path("holderStatus").asText());
    }

    @Test
    void expiredKeyIsUnknownAndCannotProduceAnEmptyClaim() throws Exception {
        connect(owner);
        when(balances.balances(any(Exchange.class),anyString(),anyString()))
            .thenThrow(new ApiException(HttpStatus.BAD_REQUEST,"expired key"));
        var post = json.readTree(mvc.perform(post("/api/v1/posts").with(jwt().jwt(token -> token.subject(Long.toString(owner))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"coinSymbol\":\"ETH\",\"title\":\"title\",\"content\":\"body\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.verifiedHolder").value(false))
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("UNKNOWN"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").doesNotExist())
            .andReturn().getResponse().getContentAsString());
        assertFalse(post.toString().contains(key));
    }

    @Test
    void observedExchangeCurrencyEnablesItsRoomVerificationCapability() throws Exception {
        connect(owner);
        when(balances.balances(any(Exchange.class),anyString(),anyString())).thenReturn(List.of(
            new ExchangeBalanceClient.Balance("SOL",new BigDecimal("2"),BigDecimal.ZERO,new BigDecimal("2"))));
        mvc.perform(post("/api/v1/posts").with(jwt().jwt(token -> token.subject(Long.toString(owner))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"coinSymbol\":\"SOL\",\"title\":\"title\",\"content\":\"body\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.holderSnapshot.verificationAvailability").value("SUPPORTED"))
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("EXCHANGE"));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans={true,false})
    void sameCredentialCannotBeLinkedByAnotherMemberIncludingLegacyRows(boolean legacy) throws Exception {
        if (legacy) {
            connections.saveAndFlush(new ExchangeConnection(members.findById(owner).orElseThrow(),Exchange.UPBIT,
                cipher.encrypt(key),cipher.encrypt("test-only-secret")));
        } else connect(owner);
        long other = members.saveAndFlush(new Member(UUID.randomUUID().toString(),"#123456")).getId();
        mvc.perform(post("/api/v1/me/exchanges/upbit").with(jwt().jwt(token -> token.subject(Long.toString(other))))
            .contentType(MediaType.APPLICATION_JSON).content(credentials)).andExpect(status().isConflict());
        org.junit.jupiter.api.Assertions.assertTrue(connections.findByMemberIdAndExchange(other,Exchange.UPBIT).isEmpty());
    }

    private void connect(long member) throws Exception {
        var body = mvc.perform(post("/api/v1/me/exchanges/upbit").with(jwt().jwt(token -> token.subject(Long.toString(member))))
            .contentType(MediaType.APPLICATION_JSON).content(credentials)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains(key));
        assertFalse(body.contains("fingerprint"));
    }
    private JsonNode publish() throws Exception {
        return json.readTree(mvc.perform(post("/api/v1/posts").with(jwt().jwt(token -> token.subject(Long.toString(owner))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"coinSymbol\":\"ETH\",\"title\":\"title\",\"content\":\"body\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    private List<ExchangeBalanceClient.Balance> eth(String amount) {
        return List.of(new ExchangeBalanceClient.Balance("ETH",new BigDecimal(amount),BigDecimal.ZERO,new BigDecimal(amount)));
    }
}
