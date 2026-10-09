package com.cryptalk.wallet;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptalk.member.MemberRepository;
import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.asset.AssetSnapshotRepository;
import com.cryptalk.coin.CoinRepository;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class WalletApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired WalletRepository wallets;
    @Autowired WalletConnectionEventRepository events;
    @Autowired AssetSnapshotRepository snapshots;
    @Autowired CoinRepository coins;

    @Test
    void listsOwnWalletsAndOnlyOwnerCanDisconnect() throws Exception {
        Account owner = signup("wallet-owner", "지갑주인");
        Account other = signup("wallet-other", "다른회원");
        Wallet wallet = wallets.save(new Wallet(members.findById(owner.id()).orElseThrow(),
            "0x1111111111111111111111111111111111111111"));

        var eth = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow();
        var cached = new AssetSnapshot(members.findById(owner.id()).orElseThrow(), eth);
        cached.capture(BigDecimal.TEN, BigDecimal.TEN, true, "VERIFIED", 1);
        snapshots.save(cached);

        mvc.perform(get("/api/v1/me/wallets").header("Authorization", bearer(owner.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(wallet.getId()))
            .andExpect(jsonPath("$[0].chainType").value("EVM"))
            .andExpect(jsonPath("$[0].address").value(wallet.getAddress()));

        mvc.perform(delete("/api/v1/me/wallets/{walletId}", wallet.getId())
                .header("Authorization", bearer(other.token())))
            .andExpect(status().isNotFound());
        assertTrue(snapshots.findByMemberIdAndCoinId(owner.id(), eth.getId()).isPresent());

        mvc.perform(delete("/api/v1/me/wallets/{walletId}", wallet.getId())
                .header("Authorization", bearer(owner.token())))
            .andExpect(status().isNoContent());

        mvc.perform(get("/api/v1/me/wallets").header("Authorization", bearer(owner.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        org.junit.jupiter.api.Assertions.assertEquals(1, events.count());
        assertFalse(snapshots.findByMemberIdAndCoinId(owner.id(), eth.getId()).isPresent());
    }

    @Test
    void walletManagementRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/me/wallets")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/me/wallets/1")).andExpect(status().isUnauthorized());
    }

    private Account signup(String loginId, String nickname) throws Exception {
        String body = "{\"loginId\":\"" + loginId + "\",\"password\":\"strong-password-123\",\"nickname\":\"" + nickname + "\"}";
        MvcResult result = mvc.perform(post("/api/v1/auth/signup").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andReturn();
        JsonNode response = json.readTree(result.getResponse().getContentAsString());
        return new Account(response.get("accessToken").asText(), response.get("member").get("id").asLong());
    }

    private String bearer(String token) { return "Bearer " + token; }
    private record Account(String token, long id) {}
}
