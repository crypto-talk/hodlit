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
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Arrays;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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
    @Autowired JdbcTemplate jdbc;

    @Test
    void listsOwnWalletsAndOnlyOwnerCanDisconnect() throws Exception {
        long previousEvents = events.count();
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
        org.junit.jupiter.api.Assertions.assertEquals(previousEvents + 1, events.count());
        assertFalse(snapshots.findByMemberIdAndCoinId(owner.id(), eth.getId()).isPresent());
    }

    @Test
    void walletManagementRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/me/wallets")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/me/wallets/1")).andExpect(status().isUnauthorized());
    }

    @Test
    void linksAndDisconnectsSolanaWalletUsingAnAccountBoundNonce() throws Exception {
        Account owner = signup("solana-owner", "솔라나주인");
        Account other = signup("solana-other", "솔라나회원");
        KeyPair keys = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        byte[] publicKey = keys.getPublic().getEncoded();
        String address = base58(Arrays.copyOfRange(publicKey, publicKey.length - 32, publicKey.length));
        JsonNode nonce = solanaNonce(owner, address);
        String message = nonce.get("message").asText();
        String nonceId = nonce.get("nonceId").asText();
        assertTrue(message.contains(address));

        var link = Map.of("chainType", "SOLANA", "walletAddress", address, "nonceId", nonceId,
            "signature", sign(keys, message));
        mvc.perform(walletRequest("/api/v1/me/wallet", other, link))
            .andExpect(status().isUnauthorized());
        mvc.perform(walletRequest("/api/v1/me/wallet", owner,
                Map.of("walletAddress", "0x1111111111111111111111111111111111111111",
                    "nonceId", nonceId, "signature", sign(keys, message))))
            .andExpect(status().isUnauthorized());
        mvc.perform(walletRequest("/api/v1/me/wallet", owner,
                Map.of("chainType", "SOLANA", "walletAddress", address, "nonceId", nonceId,
                    "signature", sign(keys, message + " altered"))))
            .andExpect(status().isUnauthorized());

        mvc.perform(walletRequest("/api/v1/me/wallet", owner, link))
            .andExpect(status().isOk()).andExpect(jsonPath("$.walletAddress").value(address));
        mvc.perform(walletRequest("/api/v1/me/wallet", owner, link))
            .andExpect(status().isUnauthorized());

        var otherNonce = solanaNonce(other, address);
        mvc.perform(walletRequest("/api/v1/me/wallet", other,
                Map.of("chainType", "SOLANA", "walletAddress", address,
                    "nonceId", otherNonce.get("nonceId").asText(),
                    "signature", sign(keys, otherNonce.get("message").asText()))))
            .andExpect(status().isConflict());

        var listed = mvc.perform(get("/api/v1/me/wallets").header("Authorization", bearer(owner.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].chainType").value("SOLANA"))
            .andExpect(jsonPath("$[0].address").value(address))
            .andReturn();
        long walletId = json.readTree(listed.getResponse().getContentAsString()).get(0).get("id").asLong();
        mvc.perform(get("/api/v1/me/wallets/assets").header("Authorization", bearer(owner.token())))
            .andExpect(status().isOk());
        mvc.perform(delete("/api/v1/me/wallets/{walletId}", walletId).header("Authorization", bearer(other.token())))
            .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/me/wallets/{walletId}", walletId).header("Authorization", bearer(owner.token())))
            .andExpect(status().isNoContent());

        var expired = solanaNonce(owner, address);
        String expiredId = expired.get("nonceId").asText();
        jdbc.update("UPDATE auth_nonces SET expires_at = created_at WHERE id = ?", expiredId);
        mvc.perform(walletRequest("/api/v1/me/wallet", owner,
                Map.of("chainType", "SOLANA", "walletAddress", address, "nonceId", expiredId,
                    "signature", sign(keys, expired.get("message").asText()))))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsMalformedSolanaAddressAndAllowsLegacyEvmNonce() throws Exception {
        Account owner = signup("wallet-chain", "지갑체인");
        mvc.perform(walletRequest("/api/v1/me/wallet/nonce", owner,
                Map.of("chainType", "SOLANA", "walletAddress", "0x1111111111111111111111111111111111111111")))
            .andExpect(status().isBadRequest());
        mvc.perform(walletRequest("/api/v1/me/wallet/nonce", owner,
                Map.of("chainType", "BITCOIN", "walletAddress", "11111111111111111111111111111111")))
            .andExpect(status().isBadRequest());
        var key = org.web3j.crypto.Keys.createEcKeyPair();
        String address = "0x" + org.web3j.crypto.Keys.getAddress(key);
        var issued = mvc.perform(walletRequest("/api/v1/me/wallet/nonce", owner, Map.of("walletAddress", address)))
            .andExpect(status().isOk()).andReturn();
        JsonNode nonce = json.readTree(issued.getResponse().getContentAsString());
        var signed = org.web3j.crypto.Sign.signPrefixedMessage(nonce.get("message").asText().getBytes(StandardCharsets.UTF_8), key);
        var hex = java.util.HexFormat.of();
        String signature = "0x" + hex.formatHex(signed.getR()) + hex.formatHex(signed.getS()) + hex.formatHex(signed.getV());
        mvc.perform(walletRequest("/api/v1/me/wallet", owner,
                Map.of("walletAddress", address, "nonceId", nonce.get("nonceId").asText(), "signature", signature)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.walletAddress").value(address));
    }

    private JsonNode solanaNonce(Account account, String address) throws Exception {
        var result = mvc.perform(walletRequest("/api/v1/me/wallet/nonce", account,
                Map.of("chainType", "SOLANA", "walletAddress", address)))
            .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }

    private MockHttpServletRequestBuilder walletRequest(
            String path, Account account, Map<String, String> body) throws Exception {
        return post(path).header("Authorization", bearer(account.token()))
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
    }

    private static String sign(KeyPair key, String message) throws Exception {
        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(key.getPrivate());
        signer.update(message.getBytes(StandardCharsets.UTF_8));
        return base58(signer.sign());
    }

    private static String base58(byte[] bytes) {
        String alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        BigInteger radix = BigInteger.valueOf(58);
        StringBuilder encoded = new StringBuilder();
        for (BigInteger value = new BigInteger(1, bytes); value.signum() > 0;) {
            BigInteger[] quotientAndRemainder = value.divideAndRemainder(radix);
            encoded.append(alphabet.charAt(quotientAndRemainder[1].intValue()));
            value = quotientAndRemainder[0];
        }
        for (int i = 0; i < bytes.length && bytes[i] == 0; i++) encoded.append('1');
        return encoded.reverse().toString();
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
