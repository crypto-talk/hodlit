package com.cryptalk.asset;

import java.math.BigDecimal;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class EthereumBalanceClient {
    private final NativeBalanceRpcClient rpc;

    public EthereumBalanceClient(@Value("${cryptalk.asset.ethereum-rpc-url}") String rpcUrl, RestClient.Builder builder) {
        rpc = new NativeBalanceRpcClient(rpcUrl, builder, "Ethereum", null);
    }

    public BalanceResult balanceOf(String address) { return balanceOf(address, Duration.ofSeconds(3)); }

    public BalanceResult balanceOf(String address, Duration budget) {
        var result = rpc.balanceOf(address, budget);
        return new BalanceResult(result.quantity(), result.status());
    }

    public record BalanceResult(BigDecimal quantity, String status) {}
}
