package com.cryptalk.exchange;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.common.ApiException;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "cryptalk.exchange.encryption-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
@AutoConfigureMockMvc
@Transactional
class ExchangeAccountUniquenessTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired ExchangeConnectionRepository connections;
    @Autowired ExchangeCredentialCipher cipher;
    @MockitoBean ExchangeAccountClient accounts;
    @MockitoBean ExchangeBalanceClient balances;
    long owner;
    long other;

    @BeforeEach
    void setup() {
        owner = member();
        other = member();
        when(accounts.accountId(any(), anyString(), anyString())).thenReturn("same-provider-account");
        var assets = List.of(new ExchangeBalanceClient.Balance("ETH", BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ONE));
        when(accounts.bithumbBalances(anyString(), anyString())).thenReturn(assets);
        when(balances.balances(any(), anyString(), anyString())).thenReturn(assets);
    }

    @ParameterizedTest
    @EnumSource(value = Exchange.class, names = {"UPBIT", "BITHUMB"})
    void differentKeysForSameAccountCannotBeAttachedToDifferentMembers(Exchange exchange) throws Exception {
        assertEquals(200, connect(owner, exchange, "key-a"));
        assertEquals(409, connect(other, exchange, "key-b"));
        assertTrue(connections.findByMemberIdAndExchange(other, exchange).isEmpty());
        assertNotNull(connections.findByMemberIdAndExchange(owner, exchange).orElseThrow().getAccountFingerprint());
    }

    @ParameterizedTest
    @EnumSource(value = Exchange.class, names = {"UPBIT", "BITHUMB"})
    void ownerCanRotateKeysAndIndependentAccountsCanConnect(Exchange exchange) throws Exception {
        assertEquals(200, connect(owner, exchange, "key-a"));
        String identity = connections.findByMemberIdAndExchange(owner, exchange).orElseThrow().getAccountFingerprint();
        assertEquals(200, connect(owner, exchange, "key-b"));
        var changed = connections.findByMemberIdAndExchange(owner, exchange).orElseThrow();
        assertEquals(identity, changed.getAccountFingerprint());
        assertEquals("key-b", cipher.decrypt(changed.getEncryptedAccessKey()));
        when(accounts.accountId(eq(exchange), eq("key-c"), anyString())).thenReturn("independent-account");
        assertEquals(200, connect(other, exchange, "key-c"));
    }

    @ParameterizedTest
    @EnumSource(value = Exchange.class, names = {"UPBIT", "BITHUMB"})
    void legacyConnectionsAreCheckedBeforeAllowingDifferentKeys(Exchange exchange) throws Exception {
        legacy(owner, exchange, "key-a");
        assertEquals(409, connect(other, exchange, "key-b"));
        assertTrue(connections.findByMemberIdAndExchange(other, exchange).isEmpty());
    }

    @ParameterizedTest
    @EnumSource(value = Exchange.class, names = {"UPBIT", "BITHUMB"})
    void failingLegacyLookupCannotBypassAccountUniqueness(Exchange exchange) throws Exception {
        legacy(owner, exchange, "expired-key");
        when(accounts.accountId(eq(exchange), eq("expired-key"), anyString()))
            .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "expired"));
        assertEquals(503, connect(other, exchange, "new-key"));
        mvc.perform(get("/api/v1/me/exchanges/{exchange}/assets", exchange.name())
                .with(jwt().jwt(token -> token.subject(Long.toString(owner)))))
            .andExpect(status().isServiceUnavailable());
        assertTrue(connections.findByMemberIdAndExchange(other, exchange).isEmpty());
        // The original owner can still recover by replacing the expired key.
        assertEquals(200, connect(owner, exchange, "new-key"));
    }

    @ParameterizedTest
    @EnumSource(value = Exchange.class, names = {"UPBIT", "BITHUMB"})
    void identityFailureDoesNotStoreOrReplaceCredentials(Exchange exchange) throws Exception {
        assertEquals(200, connect(owner, exchange, "old-key"));
        when(accounts.accountId(eq(exchange), eq("new-key"), anyString()))
            .thenThrow(new ApiException(HttpStatus.BAD_GATEWAY, "identity unavailable"));
        assertEquals(502, connect(owner, exchange, "new-key"));
        assertEquals("old-key", cipher.decrypt(connections.findByMemberIdAndExchange(owner, exchange)
            .orElseThrow().getEncryptedAccessKey()));
    }

    @Test
    void providerNamesScopeIdentityAndResponsesHideIt() throws Exception {
        assertEquals(200, connect(owner, Exchange.UPBIT, "upbit-key"));
        assertEquals(200, connect(other, Exchange.BITHUMB, "bithumb-key"));
        var upbit = connections.findByMemberIdAndExchange(owner, Exchange.UPBIT).orElseThrow();
        var bithumb = connections.findByMemberIdAndExchange(other, Exchange.BITHUMB).orElseThrow();
        assertNotEquals(upbit.getAccountFingerprint(), bithumb.getAccountFingerprint());
        String response = mvc.perform(get("/api/v1/me/exchanges").with(jwt().jwt(token -> token.subject(Long.toString(owner)))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertFalse(response.contains("same-provider-account"));
        assertFalse(response.contains(upbit.getAccountFingerprint()));
        assertFalse(response.contains("upbit-key"));
        assertFalse(response.contains("accountId"));
    }

    @Test
    void disconnectAllowsTheAccountToBeConnectedAgain() throws Exception {
        assertEquals(200, connect(owner, Exchange.UPBIT, "key-a"));
        mvc.perform(delete("/api/v1/me/exchanges/upbit").with(jwt().jwt(token -> token.subject(Long.toString(owner)))))
            .andExpect(status().isNoContent());
        connections.flush();
        assertEquals(200, connect(other, Exchange.UPBIT, "key-b"));
    }

    @Test
    void coinoneContinuesWithoutInventingAccountIdentity() throws Exception {
        assertEquals(200, connect(owner, Exchange.COINONE, "key-a"));
        assertEquals(200, connect(other, Exchange.COINONE, "key-b"));
        assertNull(connections.findByMemberIdAndExchange(owner, Exchange.COINONE).orElseThrow().getAccountFingerprint());
        verify(accounts, never()).accountId(eq(Exchange.COINONE), anyString(), anyString());
    }

    @ParameterizedTest
    @EnumSource(value = Exchange.class, names = {"UPBIT", "BITHUMB"})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentDifferentKeysCanOnlyCreateOneAccountConnection(Exchange exchange) throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        when(accounts.accountId(eq(exchange), anyString(), anyString())).thenAnswer(call -> {
            ready.countDown();
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            return "concurrent-account-" + owner;
        });
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> connect(owner, exchange, "concurrent-a-" + owner));
            var second = executor.submit(() -> connect(other, exchange, "concurrent-b-" + other));
            var statuses = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            assertTrue(statuses.contains(200));
            assertTrue(statuses.contains(409));
            int count = (connections.findByMemberIdAndExchange(owner, exchange).isPresent() ? 1 : 0)
                + (connections.findByMemberIdAndExchange(other, exchange).isPresent() ? 1 : 0);
            assertEquals(1, count);
        } finally {
            for (long id : new long[]{owner, other}) {
                connections.findByMemberIdAndExchange(id, exchange).ifPresent(connections::delete);
                members.deleteById(id);
            }
        }
    }

    private long member() {
        return members.saveAndFlush(new Member(UUID.randomUUID().toString(), "#123456")).getId();
    }

    private void legacy(long memberId, Exchange exchange, String key) {
        connections.saveAndFlush(new ExchangeConnection(members.findById(memberId).orElseThrow(), exchange,
            cipher.encrypt(key), cipher.encrypt("secret")));
    }

    private int connect(long memberId, Exchange exchange, String key) throws Exception {
        return mvc.perform(post("/api/v1/me/exchanges/{exchange}", exchange.name())
                .with(jwt().jwt(token -> token.subject(Long.toString(memberId))))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("accessKey", key, "secretKey", "secret"))))
            .andReturn().getResponse().getStatus();
    }
}
