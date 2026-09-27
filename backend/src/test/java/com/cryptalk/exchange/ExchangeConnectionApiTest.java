package com.cryptalk.exchange;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import com.cryptalk.common.ApiException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "cryptalk.exchange.encryption-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
@AutoConfigureMockMvc
class ExchangeConnectionApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired ExchangeConnectionRepository connections;
    @MockitoBean ExchangeBalanceClient balanceClient;

    @Test
    void connectsOnlyAfterSuccessfulBalanceFetchAndNeverReturnsCredentials() throws Exception {
        Account owner = signup();
        when(balanceClient.balances(eq(Exchange.UPBIT), eq("access-value"), eq("secret-value")))
            .thenReturn(List.of(new ExchangeBalanceClient.Balance("BTC", BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ONE)));

        String response = mvc.perform(post("/api/v1/me/exchanges/upbit").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content(credentials()))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.exchange").value("UPBIT"))
            .andReturn().getResponse().getContentAsString();
        assertFalse(response.contains("access-value"));
        assertFalse(response.contains("secret-value"));
        ExchangeConnection stored = connections.findByMemberIdAndExchange(owner.id(), Exchange.UPBIT).orElseThrow();
        assertNotEquals("access-value", stored.getEncryptedAccessKey());
        assertNotEquals("secret-value", stored.getEncryptedSecretKey());

        mvc.perform(get("/api/v1/me/exchanges/upbit/assets").header("Authorization", bearer(owner.token())))
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.balances[0].currency").value("BTC"))
            .andExpect(jsonPath("$.balances[0].total").value(1));
    }

    @Test
    void isolatesConnectionsByMemberAndRejectsInvalidRequests() throws Exception {
        Account owner = signup();
        Account other = signup();
        when(balanceClient.balances(eq(Exchange.BITHUMB), any(), any())).thenReturn(List.of());
        mvc.perform(post("/api/v1/me/exchanges/bithumb").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content(credentials()))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/me/exchanges").header("Authorization", bearer(other.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/v1/me/exchanges/bithumb/assets").header("Authorization", bearer(other.token())))
            .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/me/exchanges/bithumb").header("Authorization", bearer(other.token())))
            .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/me/exchanges/unknown").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content(credentials()))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/me/exchanges/upbit").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"accessKey\":\"\",\"secretKey\":\"x\"}"))
            .andExpect(status().isBadRequest());

        mvc.perform(delete("/api/v1/me/exchanges/bithumb").header("Authorization", bearer(owner.token())))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/exchanges/bithumb/assets").header("Authorization", bearer(owner.token())))
            .andExpect(status().isNotFound());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/me/exchanges")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me/exchanges/upbit/assets")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/me/exchanges/upbit").contentType(MediaType.APPLICATION_JSON).content(credentials()))
            .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/me/exchanges/upbit")).andExpect(status().isUnauthorized());
    }

    @Test
    void doesNotStoreCredentialsWhenExchangeRejectsThem() throws Exception {
        Account owner = signup();
        when(balanceClient.balances(eq(Exchange.COINONE), any(), any()))
            .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "거래소 API 키를 확인해 주세요."));
        mvc.perform(post("/api/v1/me/exchanges/coinone").header("Authorization", bearer(owner.token()))
                .contentType(MediaType.APPLICATION_JSON).content(credentials()))
            .andExpect(status().isBadRequest());
        assertFalse(connections.findByMemberIdAndExchange(owner.id(), Exchange.COINONE).isPresent());
    }

    private Account signup() throws Exception {
        String value = UUID.randomUUID().toString().substring(0, 12);
        String body = json.writeValueAsString(java.util.Map.of("loginId", "exchange-" + value,
            "password", "strong-password-123", "nickname", "교환" + value));
        String result = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode auth = json.readTree(result);
        return new Account(auth.path("accessToken").asText(), auth.path("member").path("id").asLong());
    }

    private String credentials() { return "{\"accessKey\":\"access-value\",\"secretKey\":\"secret-value\"}"; }
    private String bearer(String token) { return "Bearer " + token; }
    private record Account(String token, long id) {}
}
