package com.cryptalk.asset;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class EthereumBalanceClient {
    private static final Logger log = LoggerFactory.getLogger(EthereumBalanceClient.class);
    private static final BigDecimal WEI = BigDecimal.TEN.pow(18);
    private final String rpcUrl;
    private final RestClient restClient;

    public EthereumBalanceClient(@Value("${cryptalk.asset.ethereum-rpc-url}") String rpcUrl, RestClient.Builder builder) {
        this.rpcUrl = rpcUrl;
        this.restClient = builder.build();
        if (rpcUrl == null || rpcUrl.isBlank()) {
            log.warn("Ethereum RPC is not configured; set ETHEREUM_RPC_URL to enable EVM balance verification");
        }
    }

    public BalanceResult balanceOf(String address) {
        if (rpcUrl == null || rpcUrl.isBlank()) {
            return new BalanceResult(BigDecimal.ZERO, "UNAVAILABLE");
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post().uri(rpcUrl)
                .body(Map.of("jsonrpc", "2.0", "id", 1, "method", "eth_getBalance", "params", List.of(address, "latest")))
                .retrieve().body(Map.class);
            if (response != null && response.get("error") instanceof Map<?, ?> error) {
                Object code = error.get("code");
                log.warn("Ethereum RPC JSON-RPC failure: code={}", code instanceof Number ? code : "unknown");
                return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
            }
            Object result = response == null ? null : response.get("result");
            if (!(result instanceof String hex) || !hex.matches("0x[0-9a-fA-F]+")) {
                log.warn("Ethereum RPC returned a missing or invalid balance result");
                return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
            }
            return new BalanceResult(new BigDecimal(new BigInteger(hex.substring(2), 16)).divide(WEI), "VERIFIED");
        } catch (RestClientResponseException exception) {
            log.warn("Ethereum RPC HTTP failure: status={}", exception.getStatusCode().value());
        } catch (Exception exception) {
            // Exception messages, response bodies and URLs may contain wallet addresses or provider API keys.
            log.warn("Ethereum RPC request failed: category={}", exception.getClass().getSimpleName());
        }
        return new BalanceResult(BigDecimal.ZERO, "RPC_ERROR");
    }

    public record BalanceResult(BigDecimal quantity, String status) {}
}
