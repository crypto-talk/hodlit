package com.cryptalk.asset;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

final class NativeBalanceRpcClient {
    private static final Logger log = LoggerFactory.getLogger(NativeBalanceRpcClient.class);
    private static final BigDecimal WEI = BigDecimal.TEN.pow(18);
    private final String rpcUrl;
    private final RestClient.Builder builder;

    private final String network;
    private final Long expectedChainId;

    NativeBalanceRpcClient(String rpcUrl, RestClient.Builder builder, String network, Long expectedChainId) {
        this.rpcUrl = rpcUrl;
        this.builder = builder;
        this.network = network;
        this.expectedChainId = expectedChainId;
        if (rpcUrl == null || rpcUrl.isBlank())
            log.warn("{} RPC is not configured; set {}_RPC_URL", network, network.toUpperCase(java.util.Locale.ROOT));
    }

    public BalanceResult balanceOf(String address) {
        return balanceOf(address, Duration.ofSeconds(3));
    }

    public BalanceResult balanceOf(String address, Duration budget) {
        if (rpcUrl == null || rpcUrl.isBlank()) return new BalanceResult(BigDecimal.ZERO, "UNAVAILABLE");
        if (budget == null || budget.toMillis() < 2) return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
        int timeoutMillis = (int) Math.min(Integer.MAX_VALUE, budget.toMillis() / 2);
        SimpleClientHttpRequestFactory requests = new SimpleClientHttpRequestFactory();
        requests.setConnectTimeout(timeoutMillis);
        requests.setReadTimeout(timeoutMillis);
        RestClient client = builder.clone().requestFactory(requests).build();
        long deadline = System.nanoTime() + budget.toNanos();
        try {
            if (expectedChainId != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> chain = client.post().uri(rpcUrl)
                    .body(Map.of("jsonrpc", "2.0", "id", 1, "method", "eth_chainId", "params", List.of()))
                    .retrieve().body(Map.class);
                Object chainResult = chain == null ? null : chain.get("result");
                if (chain == null || chain.containsKey("error") || !(chainResult instanceof String hex) || !hex.matches("0x[0-9a-fA-F]+")
                        || !new BigInteger(hex.substring(2), 16).equals(BigInteger.valueOf(expectedChainId))) {
                    log.warn("{} RPC returned an invalid or mismatched chain ID", network);
                    return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
                }
                long remainingMillis = Duration.ofNanos(deadline - System.nanoTime()).toMillis();
                if (remainingMillis < 2) return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
                requests.setConnectTimeout((int) Math.min(Integer.MAX_VALUE, remainingMillis / 2));
                requests.setReadTimeout((int) Math.min(Integer.MAX_VALUE, remainingMillis / 2));
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post().uri(rpcUrl)
                .body(Map.of("jsonrpc", "2.0", "id", 1, "method", "eth_getBalance", "params", List.of(address, "latest")))
                .retrieve().body(Map.class);
            if (response != null && response.get("error") instanceof Map<?, ?> error) {
                Object code = error.get("code");
                log.warn("{} RPC JSON-RPC failure: code={}", network, code instanceof Number ? code : "unknown");
                return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
            }
            Object result = response == null ? null : response.get("result");
            if (!(result instanceof String hex) || !hex.matches("0x[0-9a-fA-F]+")) {
                log.warn("{} RPC returned a missing or invalid balance result", network);
                return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
            }
            return new BalanceResult(new BigDecimal(new BigInteger(hex.substring(2), 16)).divide(WEI), "VERIFIED");
        } catch (RestClientResponseException exception) {
            log.warn("{} RPC HTTP failure: status={}", network, exception.getStatusCode().value());
        } catch (Exception exception) {
            // Exception messages, response bodies and URLs may contain wallet addresses or provider API keys.
            log.warn("{} RPC request failed: category={}", network, exception.getClass().getSimpleName());
        }
        return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
    }

    public record BalanceResult(BigDecimal quantity, String status) {}
}
