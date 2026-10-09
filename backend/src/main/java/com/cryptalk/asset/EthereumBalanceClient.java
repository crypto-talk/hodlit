package com.cryptalk.asset;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Component
public class EthereumBalanceClient {
    private static final BigDecimal WEI = BigDecimal.TEN.pow(18);
    private final String rpcUrl;
    private final RestClient.Builder builder;

    public EthereumBalanceClient(@Value("${cryptalk.asset.ethereum-rpc-url}") String rpcUrl, RestClient.Builder builder) {
        this.rpcUrl = rpcUrl;
        this.builder = builder;
    }

    public BalanceResult balanceOf(String address) {
        return balanceOf(address, Duration.ofSeconds(3));
    }

    public BalanceResult balanceOf(String address, Duration budget) {
        if (rpcUrl == null || rpcUrl.isBlank()) return new BalanceResult(BigDecimal.ZERO, "UNAVAILABLE");
        if (budget == null || budget.toMillis() < 2) return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
        // Bound both connection and read waits; each wallet gets only the remaining aggregate budget.
        int timeoutMillis = (int) Math.min(Integer.MAX_VALUE, budget.toMillis() / 2);
        SimpleClientHttpRequestFactory requests = new SimpleClientHttpRequestFactory();
        requests.setConnectTimeout(timeoutMillis);
        requests.setReadTimeout(timeoutMillis);
        RestClient client = builder.clone().requestFactory(requests).build();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post().uri(rpcUrl)
                .body(Map.of("jsonrpc", "2.0", "id", 1, "method", "eth_getBalance", "params", List.of(address, "latest")))
                .retrieve().body(Map.class);
            Object result = response == null ? null : response.get("result");
            if (!(result instanceof String hex)) return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
            return new BalanceResult(new BigDecimal(new BigInteger(hex.substring(2), 16)).divide(WEI), "VERIFIED");
        } catch (Exception ignored) {
            return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
        }
    }

    public record BalanceResult(BigDecimal quantity, String status) {}
}
