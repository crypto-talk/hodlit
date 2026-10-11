package com.cryptalk.asset;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class AlchemyPortfolioClient {
    private static final Logger log = LoggerFactory.getLogger(AlchemyPortfolioClient.class);
    public static final Map<String, Long> NETWORKS = Map.of("eth-mainnet", 1L, "matic-mainnet", 137L);
    private final String apiKey;
    private final String baseUrl;

    public AlchemyPortfolioClient(@Value("${cryptalk.alchemy.api-key:}") String apiKey,
                                  @Value("${cryptalk.alchemy.base-url:https://api.g.alchemy.com}") String baseUrl) {
        this.apiKey = apiKey.trim();
        this.baseUrl = baseUrl;
    }

    public boolean isConfigured() { return !apiKey.isBlank(); }

    public Result fetch(List<String> walletAddresses, Duration budget) {
        if (walletAddresses.isEmpty()) return result(List.of(), Set.of(), true, "READY");
        if (!isConfigured()) return result(List.of(), NETWORKS.keySet(), false, "NOT_CONFIGURED");
        var addresses = walletAddresses.stream().map(value -> value.toLowerCase(Locale.ROOT)).distinct().toList();
        if (addresses.stream().anyMatch(value -> !value.matches("0x[0-9a-f]{40}")))
            return result(List.of(), NETWORKS.keySet(), false, "UNKNOWN");
        long deadline = System.nanoTime() + Math.max(0, budget.toNanos());
        Map<String, Token> tokens = new LinkedHashMap<>();
        Set<String> failed = new HashSet<>();
        int pages = 0;
        try {
            for (int offset = 0; offset < addresses.size(); offset += 10) {
                var batch = addresses.subList(offset, Math.min(offset + 10, addresses.size()));
                String cursor = null;
                Set<String> cursors = new HashSet<>();
                do {
                    if (++pages > 20) throw new IllegalStateException("page limit");
                    long millis = Duration.ofNanos(deadline - System.nanoTime()).toMillis();
                    if (millis < 2) throw new IllegalStateException("time budget");
                    var requests = new SimpleClientHttpRequestFactory();
                    int timeout = (int) Math.min(5000, millis / 2);
                    requests.setConnectTimeout(timeout);
                    requests.setReadTimeout(timeout);
                    var client = RestClient.builder().baseUrl(baseUrl).requestFactory(requests).build();
                    Map<String, Object> body = new LinkedHashMap<>();
                    body.put("addresses", batch.stream().map(address -> Map.of("address", address,
                        "networks", List.of("eth-mainnet", "matic-mainnet"))).toList());
                    body.put("withMetadata", true);
                    body.put("withPrices", false);
                    body.put("includeNativeTokens", true);
                    body.put("includeErc20Tokens", true);
                    if (cursor != null) body.put("pageKey", cursor);
                    JsonNode page = client.post().uri(uri -> uri.pathSegment("data", "v1", apiKey,
                        "assets", "tokens", "by-address").build()).body(body).retrieve().body(JsonNode.class);
                    if (page == null || !page.path("data").path("tokens").isArray())
                        throw new IllegalStateException("invalid payload");
                    JsonNode error = page.get("error");
                    if (error != null && !error.isNull()) {
                        if (!error.path("partialErrors").isArray() || error.path("partialErrors").isEmpty())
                            failed.addAll(NETWORKS.keySet());
                        else for (var failure : error.path("partialErrors")) {
                            String network = failure.path("network").asText();
                            if (NETWORKS.containsKey(network)) failed.add(network);
                            else failed.addAll(NETWORKS.keySet());
                        }
                    }
                    for (var row : page.path("data").path("tokens")) {
                        Token token = parse(row, batch);
                        String identity = token.walletAddress() + ":" + token.network() + ":" + token.contractAddress();
                        Token previous = tokens.putIfAbsent(identity, token);
                        if (previous != null && !Objects.equals(previous.rawBalance(), token.rawBalance()))
                            failed.add(token.network());
                        if (tokens.size() > 5000) throw new IllegalStateException("token limit");
                    }
                    JsonNode next = page.path("data").get("pageKey");
                    if (next == null) next = page.get("pageKey");
                    if (next != null && !next.isNull() && !next.isTextual())
                        throw new IllegalStateException("invalid pagination");
                    cursor = next == null || next.isNull() ? null : next.asText();
                    if (cursor != null && cursor.isBlank()) cursor = null;
                    if (cursor != null && (cursor.length() > 8192 || !cursors.add(cursor)))
                        throw new IllegalStateException("invalid pagination");
                } while (cursor != null);
            }
            boolean rowFailure = tokens.values().stream().anyMatch(token -> "UNKNOWN".equals(token.status()));
            return result(tokens.values(), failed, true, failed.isEmpty() && !rowFailure ? "READY" : "PARTIAL");
        } catch (RestClientResponseException exception) {
            // The URL contains the API key; never log the URL, exception text, headers or response body.
            log.warn("Alchemy portfolio HTTP failure: status={}", exception.getStatusCode().value());
        } catch (Exception exception) {
            log.warn("Alchemy portfolio failed: category={}", exception.getClass().getSimpleName());
        }
        failed.addAll(NETWORKS.keySet());
        return result(tokens.values(), failed, false, tokens.isEmpty() ? "UNKNOWN" : "PARTIAL");
    }

    private Token parse(JsonNode row, List<String> addresses) {
        String address = row.path("address").asText().toLowerCase(Locale.ROOT);
        String network = row.path("network").asText();
        if (!addresses.contains(address) || !NETWORKS.containsKey(network))
            throw new IllegalStateException("unexpected wallet or network");
        JsonNode contractNode = row.get("tokenAddress");
        if (contractNode == null) throw new IllegalStateException("missing asset identity");
        String contract = contractNode == null || contractNode.isNull() ? null : contractNode.asText().toLowerCase(Locale.ROOT);
        if (contract != null && !contract.matches("0x[0-9a-f]{40}"))
            throw new IllegalStateException("invalid contract");
        String raw = row.path("tokenBalance").asText();
        String balance = raw.matches("0x[0-9a-fA-F]{1,64}") ? new BigInteger(raw.substring(2), 16).toString() : null;
        var metadata = row.path("tokenMetadata");
        JsonNode decimalsNode = metadata.get("decimals");
        Integer decimals = null;
        if (contract == null) decimals = 18;
        else if (decimalsNode != null && decimalsNode.isIntegralNumber() && decimalsNode.canConvertToInt()
                && decimalsNode.asInt() >= 0 && decimalsNode.asInt() <= 255) decimals = decimalsNode.asInt();
        BigDecimal quantity = balance != null && decimals != null ? new BigDecimal(new BigInteger(balance), decimals) : null;
        String nativeSymbol = network.equals("eth-mainnet") ? "ETH" : "POL";
        return new Token(address, network, NETWORKS.get(network), contract,
            contract == null ? nativeSymbol : text(metadata, "symbol", 80), text(metadata, "name", 200),
            decimals, balance, quantity, balance == null ? "UNKNOWN" : "READY");
    }

    private String text(JsonNode node, String field, int limit) {
        String value = node.path(field).isTextual() ? node.path(field).asText() : null;
        return value == null ? null : value.substring(0, Math.min(value.length(), limit));
    }

    private Result result(Collection<Token> tokens, Collection<String> failed, boolean complete, String status) {
        return new Result(List.copyOf(tokens), failed.stream().sorted().toList(), complete, status, Instant.now());
    }

    public record Token(String walletAddress, String network, long chainId, String contractAddress, String symbol,
                        String name, Integer decimals, String rawBalance, BigDecimal quantity, String status) {}
    public record Result(List<Token> assets, List<String> failedNetworks, boolean paginationComplete,
                         String syncStatus, Instant capturedAt) {
        public boolean completeFor(long chainId) {
            String network = NETWORKS.entrySet().stream().filter(entry -> entry.getValue() == chainId)
                .map(Map.Entry::getKey).findFirst().orElse(null);
            return network != null && paginationComplete && !failedNetworks.contains(network);
        }
    }
}
