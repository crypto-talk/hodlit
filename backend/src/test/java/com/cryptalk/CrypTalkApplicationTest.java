package com.cryptalk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class CrypTalkApplicationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired CoinRepository coins;

    @Test
    void documentsEveryControllerWithKoreanSwaggerNamesAndSummaries() throws Exception {
        MvcResult result = mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andReturn();
        JsonNode document = json.readTree(result.getResponse().getContentAsString());
        Set<String> expectedTags = Set.of("인증", "코인·커뮤니티", "댓글", "실시간 시세", "미디어",
            "내 정보·자산", "게시글·피드", "팔로우", "지갑 연결", "거래소 자산", "임시저장", "방 뉴스", "방 투표", "검색", "서비스 관리자 방 관리", "공개 프로필", "배너", "뽑기 이벤트", "관리자 등급 배지", "서비스 운영 관리", "방·카테고리 관리", "공개 프로필 자산 설정");
        Set<String> actualTags = new HashSet<>();
        Set<String> httpMethods = Set.of("get", "post", "put", "patch", "delete", "options", "head");
        int operationCount = 0;

        for (JsonNode path : document.path("paths")) {
            for (var field : path.properties()) {
                if (!httpMethods.contains(field.getKey())) continue;
                JsonNode operation = field.getValue();
                assertTrue(operation.hasNonNull("summary") && !operation.get("summary").asText().isBlank());
                operation.path("tags").forEach(tag -> actualTags.add(tag.asText()));
                operationCount++;
            }
        }

        assertTrue(operationCount >= 83);
        assertTrue(document.path("paths").has("/api/v1/communities/stats"));
        assertTrue(document.path("paths").has("/api/v1/communities/{symbol}/stats"));
        assertTrue(document.path("paths").has("/api/v1/members/by-nickname/{nickname}"));
        assertTrue(document.path("paths").has("/api/v1/members/{memberId}/posts/page"));
        assertTrue(document.path("paths").has("/api/v1/members/{memberId}/comments/page"));
        JsonNode schemas = document.path("components").path("schemas");
        assertTrue(schemas.path("PublicProfilePost").path("properties").has("holderSnapshot"));
        assertFalse(schemas.path("PublicProfilePost").path("properties").has("assetValueKrw"));
        assertTrue(schemas.path("PostResponse").path("properties").has("assetValueKrw"));
        assertTrue(schemas.path("PublicProfileAsset").path("properties").has("quantityBand"));
        assertFalse(schemas.path("PublicProfileAsset").path("properties").has("quantity"));
        for (var endpoint : java.util.Map.of(
                "/api/v1/members/{memberId}/posts/page", "PublicProfilePost",
                "/api/v1/members/{memberId}/comments/page", "PublicProfileComment").entrySet()) {
            JsonNode content = document.path("paths").path(endpoint.getKey()).path("get").path("responses")
                .path("200").path("content");
            assertFalse(content.isEmpty());
            String pageRef = content.elements().next().path("schema").path("$ref").asText();
            JsonNode pageSchema = schemas.path(pageRef.substring(pageRef.lastIndexOf('/') + 1));
            assertEquals("#/components/schemas/" + endpoint.getValue(),
                pageSchema.path("properties").path("items").path("items").path("$ref").asText());
        }
        assertEquals(expectedTags, actualTags);
        assertFalse(actualTags.stream().anyMatch(tag -> tag.endsWith("-controller")));
    }

    @Test
    void exposesSeededCoins() throws Exception {
        mvc.perform(get("/api/v1/coins"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(20))
            .andExpect(jsonPath("$[0].symbol").value("BTC"))
            .andExpect(jsonPath("$[0].verificationAvailability").value("SUPPORTED"))
            .andExpect(jsonPath("$[1].symbol").value("ETH"))
            .andExpect(jsonPath("$[1].verificationAvailability").value("SUPPORTED"))
            .andExpect(jsonPath("$[19].symbol").value("SUI"));

        var activeCoins = coins.findByActiveTrueOrderByDisplayOrder();
        assertEquals(List.of("BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "BNB", "AVAX", "DOT", "LINK",
            "POL", "TON", "TRX", "LTC", "BCH", "UNI", "AAVE", "ATOM", "NEAR", "SUI"),
            activeCoins.stream().map(Coin::getSymbol).toList());
        assertTrue(activeCoins.stream().allMatch(coin -> coin.getMarketPriceId() != null && !coin.getMarketPriceId().isBlank()));
    }

    @Test
    void doesNotExposeApiTestPageByDefault() throws Exception {
        mvc.perform(get("/test"))
            .andExpect(status().isNotFound());
    }

    @Test
    void rejectsRemovedWalletLoginEndpoint() throws Exception {
        mvc.perform(post("/api/v1/auth/nonce")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"walletAddress\":\"0x1111111111111111111111111111111111111111\"}"))
            .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/v1/auth/wallet")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void signsUpAndLogsInWithLoginId() throws Exception {
        mvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"satoshi_21\",\"password\":\"strong-password-123\",\"nickname\":\"새회원\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.member.nickname").value("새회원"))
            .andExpect(jsonPath("$.member.walletAddress").doesNotExist());

        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"SATOSHI_21\",\"password\":\"strong-password-123\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.member.nickname").value("새회원"));
    }

    @Test
    void rejectsInvalidLoginIdPassword() throws Exception {
        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"missing-user\",\"password\":\"wrong-password\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsEmailOnlyLoginRequest() throws Exception {
        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"member@example.com\",\"password\":\"strong-password-123\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsDuplicateLoginIdIgnoringCase() throws Exception {
        mvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"duplicate-user\",\"password\":\"strong-password-123\",\"nickname\":\"첫회원\"}"))
            .andExpect(status().isOk());

        mvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"loginId\":\"DUPLICATE-USER\",\"password\":\"strong-password-123\",\"nickname\":\"둘째회원\"}"))
            .andExpect(status().isConflict());
    }
}
