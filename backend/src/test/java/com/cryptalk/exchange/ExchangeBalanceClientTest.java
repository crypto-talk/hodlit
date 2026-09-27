package com.cryptalk.exchange;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

class ExchangeBalanceClientTest {
    private HttpServer server;
    private ExchangeBalanceClient client;
    private final ObjectMapper json = new ObjectMapper();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> coinonePayload = new AtomicReference<>();
    private final AtomicReference<String> coinoneSignature = new AtomicReference<>();
    private final AtomicReference<String> coinoneBody = new AtomicReference<>();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/accounts", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] response = "[{\"currency\":\"BTC\",\"balance\":\"1.25\",\"locked\":\"0.75\"}]".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (var output = exchange.getResponseBody()) { output.write(response); }
        });
        server.createContext("/v2.1/account/balance/all", exchange -> {
            coinonePayload.set(exchange.getRequestHeaders().getFirst("X-COINONE-PAYLOAD"));
            coinoneSignature.set(exchange.getRequestHeaders().getFirst("X-COINONE-SIGNATURE"));
            coinoneBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] response = "{\"result\":\"success\",\"error_code\":\"0\",\"balances\":[{\"currency\":\"eth\",\"available\":\"2\",\"limit\":\"0.5\"}]}".getBytes(StandardCharsets.UTF_8);
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
