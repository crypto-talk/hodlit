package com.cryptalk.asset;

import java.math.BigDecimal;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class PolygonBalanceClient {
    private final NativeBalanceRpcClient rpc;

    public PolygonBalanceClient(@Value("${cryptalk.asset.polygon-rpc-url:}") String rpcUrl, RestClient.Builder builder) {
        rpc = new NativeBalanceRpcClient(rpcUrl, builder, "Polygon", 137L);
    }

    public BalanceResult balanceOf(String address) { return balanceOf(address, Duration.ofSeconds(3)); }

    public BalanceResult balanceOf(String address, Duration budget) {
        var result = rpc.balanceOf(address, budget);
        return new BalanceResult(result.quantity(), result.status());
    }

    public record BalanceResult(BigDecimal quantity, String status) {}
}
