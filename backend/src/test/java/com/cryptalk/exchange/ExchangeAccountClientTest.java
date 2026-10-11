package com.cryptalk.exchange;

import static org.junit.jupiter.api.Assertions.*;

import com.cryptalk.common.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicReference;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(OutputCaptureExtension.class)
class ExchangeAccountClientTest {
    private HttpServer server;
    private ExchangeAccountClient client;
    private final ObjectMapper json = new ObjectMapper();
    private String response;
    private int status = 200;
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> path = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();
    private final AtomicReference<String> key = new AtomicReference<>();
    private final AtomicReference<String> nonce = new AtomicReference<>();
    private final AtomicReference<String> signature = new AtomicReference<>();
    private final AtomicReference<String> separator = new AtomicReference<>();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::reply);
        server.start();
        String url = "http://127.0.0.1:" + server.getAddress().getPort();
        client = new ExchangeAccountClient(url, url, json);
    }

    private void reply(HttpExchange exchange) throws java.io.IOException {
        authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
        path.set(exchange.getRequestURI().getPath());
        body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        key.set(exchange.getRequestHeaders().getFirst("Api-Key"));
        nonce.set(exchange.getRequestHeaders().getFirst("Api-Nonce"));
        signature.set(exchange.getRequestHeaders().getFirst("Api-Sign"));
        separator.set(exchange.getRequestHeaders().getFirst("api-client-type"));
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) { output.write(bytes); }
    }

    @AfterEach void stop() { server.stop(0); }

    @Test
    void findsMainPocketRegardlessOfOrderingAndSignsUpbitRequest() throws Exception {
        response = "[{\"uuid\":\"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\",\"type\":\"user_spot_trading\"},"
            + "{\"uuid\":\"AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB\",\"type\":\"main\"}]";
        assertEquals("aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb", client.accountId(Exchange.UPBIT, "access", "secret"));
        assertEquals("/v1/pockets", path.get());
        String[] token = authorization.get().substring(7).split("\\.");
        assertEquals("HS512", json.readTree(Base64.getUrlDecoder().decode(token[0])).path("alg").asText());
        var claims = json.readTree(Base64.getUrlDecoder().decode(token[1]));
        assertEquals("access", claims.path("access_key").asText());
        assertTrue(claims.hasNonNull("nonce"));
        assertEquals(Base64.getUrlEncoder().withoutPadding().encodeToString(mac(token[0] + "." + token[1])), token[2]);
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "{}", "[]", "[{\"type\":\"main\"}]",
        "[{\"uuid\":\"not-a-uuid\",\"type\":\"main\"}]",
        "[{\"uuid\":\"aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb\",\"type\":\"main\"},"
            + "{\"uuid\":\"aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb\",\"type\":\"main\"}]"})
    void refusesUnprovenOrAmbiguousUpbitIdentity(String value) {
        response = value;
        assertEquals(HttpStatus.BAD_GATEWAY, assertThrows(ApiException.class,
            () -> client.accountId(Exchange.UPBIT, "access", "secret")).status());
    }

    @Test
    void readsBithumbMemberIdAndUsesDocumentedLegacySignature() throws Exception {
        response = "{\"status\":\"0000\",\"data\":{\"account_id\":\"A000105A\"}}";
        assertEquals("A000105A", client.accountId(Exchange.BITHUMB, "access", "secret"));
        assertEquals("/info/account", path.get());
        assertEquals("endpoint=%2Finfo%2Faccount&order_currency=BTC&payment_currency=KRW", body.get());
        assertEquals("access", key.get());
        assertEquals("2", separator.get());
        assertNull(authorization.get());
        String expected = HexFormat.of().formatHex(mac(path.get() + ";" + body.get() + ";" + nonce.get()));
        assertEquals(Base64.getEncoder().encodeToString(expected.getBytes(StandardCharsets.UTF_8)), signature.get());
    }

    @Test
    void readsBithumbAvailableAndLockedWithTheSameCredentialVersion() {
        response = "{\"status\":\"0000\",\"data\":{\"total_eth\":\"5\",\"available_eth\":\"3\",\"in_use_eth\":\"2\",\"xcoin_last_eth\":\"1000\"}}";
        var balance = client.bithumbBalances("access", "secret").getFirst();
        assertEquals("ETH", balance.currency());
        assertEquals("5", balance.total().toPlainString());
        assertEquals("/info/balance", path.get());
        assertEquals("endpoint=%2Finfo%2Fbalance&currency=ALL", body.get());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"status\":\"0000\",\"data\":{}}",
        "{\"status\":\"0000\",\"data\":{\"account_id\":\"\"}}",
        "{\"status\":\"0000\",\"data\":{\"account_id\":12}}",
        "{\"status\":\"0000\",\"data\":{\"account_id\":\"id\\nforged\"}}"})
    void rejectsMissingAndInvalidBithumbIdentity(String value) {
        response = value;
        assertEquals(HttpStatus.BAD_GATEWAY, assertThrows(ApiException.class,
            () -> client.accountId(Exchange.BITHUMB, "access", "secret")).status());
    }

    @Test
    void rejectsInconsistentBithumbBalances() {
        response = "{\"status\":\"0000\",\"data\":{\"total_eth\":\"5\",\"available_eth\":\"3\",\"in_use_eth\":\"1\"}}";
        assertThrows(ApiException.class, () -> client.bithumbBalances("access", "secret"));
    }

    @Test
    void rejectsProviderFailureAndNeverLogsPrivateData(CapturedOutput output) {
        status = 403;
        response = "{\"account_id\":\"private-account\",\"secret\":\"private-secret\"}";
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ApiException.class,
            () -> client.accountId(Exchange.UPBIT, "private-key", "private-secret")).status());
        assertFalse(output.getAll().contains("private-key"));
        assertFalse(output.getAll().contains("private-secret"));
        assertFalse(output.getAll().contains("private-account"));
    }

    @Test
    void coinoneIdentityIsExplicitlyDeferredAndNeverGuessed() {
        assertNull(client.accountId(Exchange.COINONE, "access", "secret"));
        assertNull(path.get());
    }

    private byte[] mac(String input) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec("secret".getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        return mac.doFinal(input.getBytes(StandardCharsets.UTF_8));
    }
}
