package com.cryptalk.asset;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sun.net.httpserver.HttpServer;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class PolygonBalanceClientTest {
    private static final String ADDRESS = "0x1111111111111111111111111111111111111111";
    private HttpServer server;
    private String url;
    private String body = "{}";
    private int status = 200;
    private String chainBody = "{\"result\":\"0x89\"}";
    private final AtomicInteger calls = new AtomicInteger();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", request -> {
            calls.incrementAndGet();
            String input = new String(request.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            byte[] bytes = (input.contains("eth_chainId") ? chainBody : body).getBytes(StandardCharsets.UTF_8);
            request.getResponseHeaders().set("Content-Type", "application/json");
            request.sendResponseHeaders(status, bytes.length);
            try (var output = request.getResponseBody()) { output.write(bytes); }
        });
        server.start();
        url = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach void stop() { server.stop(0); }

    @Test
    void zeroBalanceIsVerifiedRatherThanAnRpcFailure() {
        assertEquals("VERIFIED", result("{\"result\":\"0x0\"}").status());
        assertEquals(0, BigDecimal.ZERO.compareTo(result("{\"result\":\"0x0\"}").quantity()));
    }

    @Test
    void convertsWeiToPol() {
        assertEquals(0, BigDecimal.ONE.compareTo(result("{\"result\":\"0xde0b6b3a7640000\"}").quantity()));
    }

    @Test
    void rejectsMalformedAndJsonRpcErrorResults() {
        for (String value : new String[] {"{}", "{\"result\":\"-1\"}", "{\"result\":\"0x\"}",
            "{\"result\":\"0xGG\"}", "{\"error\":{\"code\":-32000,\"message\":\"private\"}}"}) {
            assertEquals("RPC_ERROR", result(value).status());
        }
    }

    @Test
    void httpErrorsReturnRpcError() {
        status = 429;
        assertEquals("RPC_ERROR", result("{}").status());
    }

    @Test
    void missingConfigurationDoesNotMakeANetworkCall() {
        assertEquals("UNAVAILABLE", new PolygonBalanceClient("", RestClient.builder()).balanceOf(ADDRESS).status());
        assertEquals(0, calls.get());
    }

    @Test
    void exhaustedPublicationBudgetDoesNotMakeANetworkCall() {
        var client = new PolygonBalanceClient(url, RestClient.builder());
        assertEquals("RPC_ERROR", client.balanceOf(ADDRESS, Duration.ZERO).status());
        assertEquals("RPC_ERROR", client.balanceOf(ADDRESS, Duration.ofSeconds(-1)).status());
        assertEquals(0, calls.get());
    }

    @Test
    void refusesAnotherChainBeforeReadingItsBalance() {
        chainBody = "{\"result\":\"0x1\"}";
        assertEquals("RPC_ERROR", new PolygonBalanceClient(url, RestClient.builder()).balanceOf(ADDRESS).status());
        assertEquals(1, calls.get());
    }

    @Test
    void rejectsChainErrorsAndMissingOrMalformedChainId() {
        for (String value : new String[] {"{}", "{\"result\":\"0xGG\"}", "{\"error\":{\"code\":-1}}"}) {
            chainBody = value;
            assertEquals("RPC_ERROR", new PolygonBalanceClient(url, RestClient.builder()).balanceOf(ADDRESS).status());
        }
        assertEquals(3, calls.get());
    }

    private PolygonBalanceClient.BalanceResult result(String value) {
        body = value;
        int previous = calls.get();
        var result = new PolygonBalanceClient(url, RestClient.builder()).balanceOf(ADDRESS);
        assertEquals(previous + (status == 200 ? 2 : 1), calls.get());
        return result;
    }
}
