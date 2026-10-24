package com.cryptalk.asset;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

@ExtendWith(OutputCaptureExtension.class)
class AlchemyPortfolioClientTest {
    private static final String ADDRESS = "0x1111111111111111111111111111111111111111";
    private final ObjectMapper json = new ObjectMapper();
    private HttpServer server;
    private AlchemyPortfolioClient client;
    private final List<String> requests = Collections.synchronizedList(new ArrayList<>());
    private List<String> pages;
    private int errorAt = -1;

    @BeforeEach void start() throws Exception {
        pages = List.of("{\"data\":{\"tokens\":[]}}");
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", request -> {
            int index = requests.size();
            requests.add(new String(request.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = pages.get(Math.min(index, pages.size() - 1)).getBytes(StandardCharsets.UTF_8);
            request.getResponseHeaders().set("Content-Type", "application/json");
            request.sendResponseHeaders(index == errorAt ? 429 : 200, body.length);
            try (var output = request.getResponseBody()) { output.write(body); }
        });
        server.start();
        client = new AlchemyPortfolioClient("test-only-key", "http://127.0.0.1:" + server.getAddress().getPort());
    }
    @AfterEach void stop() { server.stop(0); }

    @Test void fetchesNativeAndErc20AcrossBothNetworksWithCorrectDecimals() throws Exception {
        pages = List.of(page(token("eth-mainnet", null, "0xde0b6b3a7640000", 18, "ETH"),
            token("matic-mainnet", null, "0x4563918244f40000", 18, "POL"),
            token("eth-mainnet", ADDRESS, "0x1e8480", 6, "USDC")));
        var result = fetch();
        assertEquals("READY", result.syncStatus());
        assertEquals(0, BigDecimal.ONE.compareTo(result.assets().get(0).quantity()));
        assertEquals(0, new BigDecimal("5").compareTo(result.assets().get(1).quantity()));
        assertEquals(0, new BigDecimal("2").compareTo(result.assets().get(2).quantity()));
        var body = json.readTree(requests.getFirst());
        assertTrue(body.path("includeErc20Tokens").asBoolean());
        assertTrue(body.path("includeNativeTokens").asBoolean());
        assertFalse(body.path("withPrices").asBoolean());
        assertEquals(2, body.path("addresses").get(0).path("networks").size());
    }

    @Test void followsPagesAndDeduplicatesRepeatedBalances() throws Exception {
        String row = token("eth-mainnet", null, "0x0", 18, "ETH");
        pages = List.of("{\"data\":{\"tokens\":[" + row + "],\"pageKey\":\"next\"}}", page(row,
            token("matic-mainnet", null, "0x0", 18, "POL")));
        var result = fetch();
        assertEquals(2, result.assets().size());
        assertTrue(result.paginationComplete());
        assertEquals("next", json.readTree(requests.get(1)).path("pageKey").asText());
    }

    @Test void http200NetworkFailureCannotBeMistakenForEmptyBalance() {
        pages = List.of("{\"data\":{\"tokens\":[]},\"error\":{\"partialErrors\":[{\"network\":\"matic-mainnet\"}]}}");
        var result = fetch();
        assertEquals("PARTIAL", result.syncStatus());
        assertTrue(result.completeFor(1));
        assertFalse(result.completeFor(137));
    }

    @Test void interruptedPaginationKeepsKnownRowsButCannotCertifyZero(CapturedOutput output) {
        pages = List.of("{\"data\":{\"tokens\":[" + token("eth-mainnet", null, "0x0", 18, "ETH")
            + "],\"pageKey\":\"next\"}}", "{\"message\":\"private upstream text\"}");
        errorAt = 1;
        var result = fetch();
        assertEquals(1, result.assets().size());
        assertFalse(result.paginationComplete());
        assertFalse(result.completeFor(1));
        assertFalse(output.getAll().contains("test-only-key"));
        assertFalse(output.getAll().contains("private upstream text"));
        assertFalse(output.getAll().contains(ADDRESS));
    }

    @Test void cyclicCursorStopsWithIncompleteResult() {
        pages = List.of("{\"data\":{\"tokens\":[],\"pageKey\":\"same\"}}");
        assertFalse(fetch().paginationComplete());
        assertEquals(2, requests.size());
    }

    @Test void missingMetadataKeepsRawBalanceWithoutInventingDecimals() {
        pages = List.of(page("{\"address\":\"" + ADDRESS + "\",\"network\":\"eth-mainnet\",\"tokenAddress\":\""
            + ADDRESS + "\",\"tokenBalance\":\"0x2\",\"error\":{\"message\":\"metadata unavailable\"}}"));
        var token = fetch().assets().getFirst();
        assertEquals("2", token.rawBalance());
        assertNull(token.quantity());
        assertNull(token.decimals());
    }

    @Test void rejectsUnexpectedWalletAndMissingAssetIdentity() {
        pages = List.of(page(token("eth-mainnet", null, "0x1", 18, "ETH").replace(ADDRESS,
            "0x2222222222222222222222222222222222222222")));
        assertEquals("UNKNOWN", fetch().syncStatus());
        pages = List.of(page("{\"address\":\"" + ADDRESS + "\",\"network\":\"eth-mainnet\",\"tokenBalance\":\"0x1\"}"));
        assertEquals("UNKNOWN", fetch().syncStatus());
    }

    @Test void missingKeyAndExhaustedBudgetNeverMakeNetworkCalls() {
        assertEquals("NOT_CONFIGURED", new AlchemyPortfolioClient("", "http://localhost")
            .fetch(List.of(ADDRESS), Duration.ofSeconds(1)).syncStatus());
        assertEquals("UNKNOWN", client.fetch(List.of(ADDRESS), Duration.ZERO).syncStatus());
        assertEquals(0, requests.size());
    }

    @Test void failureOfOneWalletKeepsAnotherWalletsConfirmedBalance() {
        String second = "0x2222222222222222222222222222222222222222";
        pages = List.of("{\"data\":{\"tokens\":["
            + token("eth-mainnet", null, "0xde0b6b3a7640000", 18, "ETH") + ","
            + token("eth-mainnet", null, "0x4563918244f40000", 18, "ETH").replace(ADDRESS, second)
            + "]},\"error\":{\"partialErrors\":[{\"address\":\"" + second + "\",\"network\":\"eth-mainnet\"}]}}");
        var result = client.fetch(List.of(ADDRESS, second), Duration.ofSeconds(3));
        assertEquals(1, result.assets().size());
        assertEquals(ADDRESS, result.assets().getFirst().walletAddress());
        assertEquals(BigDecimal.ONE, result.assets().getFirst().quantity().stripTrailingZeros());
        assertFalse(result.completeFor(1));
    }

    @Test void networkFailureWithoutWalletIdentityExcludesItsBalances() {
        pages = List.of("{\"data\":{\"tokens\":["
            + token("eth-mainnet", null, "0x1", 18, "ETH") + ","
            + token("matic-mainnet", null, "0x2", 18, "POL")
            + "]},\"error\":{\"partialErrors\":[{\"network\":\"eth-mainnet\"}]}}");
        var result = fetch();
        assertEquals(1, result.assets().size());
        assertEquals("matic-mainnet", result.assets().getFirst().network());
        assertTrue(result.completeFor(137));
    }

    @Test void conflictingBalancesAreExcludedEvenWhenRepeatedAgain() {
        pages = List.of(page(token("eth-mainnet", null, "0x1", 18, "ETH"),
            token("eth-mainnet", null, "0x2", 18, "ETH"),
            token("eth-mainnet", null, "0x1", 18, "ETH")));
        var result = fetch();
        assertTrue(result.assets().isEmpty());
        assertFalse(result.completeFor(1));
    }

    @Test void malformedRowDoesNotDiscardFollowingValidWallet() {
        pages = List.of(page("{\"address\":\"" + ADDRESS + "\",\"network\":\"eth-mainnet\"}",
            token("eth-mainnet", null, "0x1", 18, "ETH")));
        var result = fetch();
        assertEquals(1, result.assets().size());
        assertFalse(result.completeFor(1));
    }

    private AlchemyPortfolioClient.Result fetch() { return client.fetch(List.of(ADDRESS), Duration.ofSeconds(3)); }
    private String page(String... rows) { return "{\"data\":{\"tokens\":[" + String.join(",", rows) + "]}}"; }
    private String token(String network, String contract, String balance, int decimals, String symbol) {
        return "{\"address\":\"" + ADDRESS + "\",\"network\":\"" + network + "\",\"tokenAddress\":"
            + (contract == null ? "null" : "\"" + contract + "\"") + ",\"tokenBalance\":\"" + balance
            + "\",\"tokenMetadata\":{\"symbol\":\"" + symbol + "\",\"decimals\":" + decimals + "}}";
    }
}
