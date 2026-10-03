package com.cryptalk.exchange;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.cryptalk.common.ApiException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(OutputCaptureExtension.class)
class ExchangeBalanceClientTest {
    private HttpServer server;
    private ExchangeBalanceClient client;
    private final ObjectMapper json = new ObjectMapper();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private int accountStatus = 200;
    private String accountResponse = "[{\"currency\":\"BTC\",\"balance\":\"1.25\",\"locked\":\"0.75\"}]";
    private String coinoneResponse = "{\"result\":\"success\",\"error_code\":\"0\",\"balances\":[{\"currency\":\"eth\",\"available\":\"2\",\"limit\":\"0.5\"}]}";
    private final AtomicReference<String> coinonePayload = new AtomicReference<>();
    private final AtomicReference<String> coinoneSignature = new AtomicReference<>();
    private final AtomicReference<String> coinoneBody = new AtomicReference<>();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/accounts", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] response = accountResponse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(accountStatus, response.length);
            try (var output = exchange.getResponseBody()) { output.write(response); }
        });
        server.createContext("/v2.1/account/balance/all", exchange -> {
            coinonePayload.set(exchange.getRequestHeaders().getFirst("X-COINONE-PAYLOAD"));
            coinoneSignature.set(exchange.getRequestHeaders().getFirst("X-COINONE-SIGNATURE"));
            coinoneBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = coinoneResponse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (var output = exchange.getResponseBody()) { output.write(response); }
        });
        server.start();
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        client = new ExchangeBalanceClient(baseUrl, baseUrl, baseUrl, json);
    }

    @AfterEach void stop() { server.stop(0); }

    @Test
    void signsUpbitAndBithumbWithoutCallingTradingEndpoints() throws Exception {
        assertEquals("2.00", client.balances(Exchange.UPBIT, "access", "secret").get(0).total().toPlainString());
        assertJwt("HS512", false);
        assertEquals("2.00", client.balances(Exchange.BITHUMB, "access", "secret").get(0).total().toPlainString());
        assertJwt("HS256", true);
    }

    @Test
    void signsCoinoneAndNormalizesBalances() throws Exception {
        var balance = client.balances(Exchange.COINONE, "access", "secret").get(0);
        assertEquals("ETH", balance.currency());
        assertEquals("2.5", balance.total().toPlainString());
        JsonNode payload = json.readTree(Base64.getDecoder().decode(coinonePayload.get()));
        assertEquals("access", payload.path("access_token").asText());
        assertTrue(payload.hasNonNull("nonce"));
        assertEquals(coinonePayload.get(), coinoneBody.get());
        assertEquals(java.util.HexFormat.of().formatHex(sign("HmacSHA512", coinonePayload.get())), coinoneSignature.get());
    }

    @ParameterizedTest
    @ValueSource(strings = {"P", "p", "1", "ABCDEFGHIJKLMNOPQRST"})
    void acceptsValidCurrencyCodesAcrossExchanges(String currency) throws Exception {
        setCurrencyResponses(json.writeValueAsString(currency));

        for (Exchange exchange : Exchange.values()) {
            var balances = client.balances(exchange, "access", "secret");
            assertEquals(2, balances.size());
            var balance = balances.get(0);
            assertEquals(currency.toUpperCase(java.util.Locale.ROOT), balance.currency());
            assertEquals("1.25", balance.available().toPlainString());
            assertEquals("0.75", balance.locked().toPlainString());
            assertEquals("2.00", balance.total().toPlainString());
            assertEquals("BTC", balances.get(1).currency());
        }
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"\"\"", "null", "\"A-B\"", "\"P P\"", "\"한\"", "\"ABCDEFGHIJKLMNOPQRSTU\""})
    void stillRejectsInvalidCurrencyCodesAcrossExchanges(String currencyJson) {
        setCurrencyResponses(currencyJson);

        for (Exchange exchange : Exchange.values()) {
            ApiException failure = assertThrows(ApiException.class,
                () -> client.balances(exchange, "access", "secret"));
            assertEquals(HttpStatus.BAD_GATEWAY, failure.status());
        }
    }

    private void setCurrencyResponses(String currencyJson) {
        String field = currencyJson == null ? "" : "\"currency\":" + currencyJson + ",";
        accountResponse = "[{" + field + "\"balance\":\"1.25\",\"locked\":\"0.75\"},"
            + "{\"currency\":\"BTC\",\"balance\":\"0\",\"locked\":\"0\"}]";
        coinoneResponse = "{\"result\":\"success\",\"error_code\":\"0\",\"balances\":[{"
            + field + "\"available\":\"1.25\",\"limit\":\"0.75\"},"
            + "{\"currency\":\"btc\",\"available\":\"0\",\"limit\":\"0\"}]}";
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 401, 403, 429, 500})
    void logsOnlySafeBithumbFailureDetails(int status, CapturedOutput output) {
        accountStatus = status;
        accountResponse = "{\"error\":{\"name\":\"ip_address_not_allowed\",\"message\":\"private-access private-secret private-balance\"}}";

        ApiException failure = assertThrows(ApiException.class,
            () -> client.balances(Exchange.BITHUMB, "private-access", "private-secret"));

        assertEquals(status == 401 || status == 403 ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_GATEWAY,
            failure.status());
        assertTrue(output.getAll().contains("exchange=BITHUMB, status=" + status + ", errorCode=ip_address_not_allowed"));
        assertFalse(output.getAll().contains("private-access"));
        assertFalse(output.getAll().contains("private-secret"));
        assertFalse(output.getAll().contains("private-balance"));
        assertFalse(output.getAll().contains(authorization.get()));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"error\":{\"name\":\"private-secret\\nforged-log\",\"message\":\"private-balance\"}}",
        "<html>private-secret private-balance</html>",
        "null",
        "{}"
    })
    void doesNotLogUnknownCodesOrMalformedBodies(String body, CapturedOutput output) {
        accountStatus = 502;
        accountResponse = body;
        assertThrows(ApiException.class,
            () -> client.balances(Exchange.BITHUMB, "private-access", "private-secret"));
        assertTrue(output.getAll().contains("exchange=BITHUMB, status=502, errorCode=unknown"));
        assertFalse(output.getAll().contains("private-secret"));
        assertFalse(output.getAll().contains("private-balance"));
        assertFalse(output.getAll().contains("forged-log"));
    }

    @Test
    void logsTransportFailureWithoutExceptionDetails(CapturedOutput output) {
        server.stop(0);
        assertThrows(ApiException.class,
            () -> client.balances(Exchange.BITHUMB, "private-access", "private-secret"));
        assertTrue(output.getAll().contains("exchange=BITHUMB, status=unavailable, errorCode=transport_error"));
        assertFalse(output.getAll().contains("private-access"));
        assertFalse(output.getAll().contains("private-secret"));
    }

    private void assertJwt(String algorithm, boolean timestamp) throws Exception {
        String token = authorization.get().substring("Bearer ".length());
        String[] parts = token.split("\\.");
        assertEquals(3, parts.length);
        assertEquals(algorithm, json.readTree(Base64.getUrlDecoder().decode(parts[0])).path("alg").asText());
        JsonNode claims = json.readTree(Base64.getUrlDecoder().decode(parts[1]));
        assertEquals("access", claims.path("access_key").asText());
        assertTrue(claims.hasNonNull("nonce"));
        assertEquals(timestamp, claims.has("timestamp"));
        assertEquals(Base64.getUrlEncoder().withoutPadding().encodeToString(sign(
            timestamp ? "HmacSHA256" : "HmacSHA512", parts[0] + "." + parts[1])), parts[2]);
    }

    private byte[] sign(String algorithm, String input) throws Exception {
        Mac mac = Mac.getInstance(algorithm);
        mac.init(new SecretKeySpec("secret".getBytes(StandardCharsets.UTF_8), algorithm));
        return mac.doFinal(input.getBytes(StandardCharsets.UTF_8));
    }
}
