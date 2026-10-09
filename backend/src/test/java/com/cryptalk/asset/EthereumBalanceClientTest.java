package com.cryptalk.asset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class EthereumBalanceClientTest {
    private static final String URL = "https://rpc.example.test";
    private static final String ADDRESS = "0x1111111111111111111111111111111111111111";

    @Test
    void zeroBalanceIsVerifiedRatherThanAnRpcFailure() {
        assertEquals("VERIFIED", result("{\"result\":\"0x0\"}").status());
        assertEquals(0, BigDecimal.ZERO.compareTo(result("{\"result\":\"0x0\"}").quantity()));
    }

    @Test
    void convertsWeiToEth() {
        assertEquals(0, BigDecimal.ONE.compareTo(result("{\"result\":\"0xde0b6b3a7640000\"}").quantity()));
    }

    @Test
    void rejectsMalformedAndJsonRpcErrorResults() {
        for (String body : new String[] {"{}", "{\"result\":\"-1\"}", "{\"result\":\"0x\"}",
            "{\"result\":\"0xGG\"}", "{\"error\":{\"code\":-32000,\"message\":\"private\"}}"}) {
            assertEquals("RPC_ERROR", result(body).status());
        }
    }

    @Test
    void httpErrorsReturnRpcError() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(URL)).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        assertEquals("RPC_ERROR", new EthereumBalanceClient(URL, builder).balanceOf(ADDRESS).status());
        server.verify();
    }

    @Test
    void missingConfigurationDoesNotMakeANetworkCall() {
        assertEquals("UNAVAILABLE", new EthereumBalanceClient("", RestClient.builder()).balanceOf(ADDRESS).status());
    }

    private EthereumBalanceClient.BalanceResult result(String body) {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(URL)).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        var result = new EthereumBalanceClient(URL, builder).balanceOf(ADDRESS);
        server.verify();
        return result;
    }
}
