package com.cryptalk;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cryptalk.coin.Coin;
import com.cryptalk.asset.EthereumBalanceClient;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.wallet.Wallet;
import com.cryptalk.wallet.WalletRepository;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.market.MarketPriceService.PriceQuote;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verifyNoInteractions;

@SpringBootTest
@AutoConfigureMockMvc
class SocialApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired WalletRepository wallets;
    @MockitoBean MarketPriceService marketPrices;
    @MockitoBean EthereumBalanceClient ethereum;

    @BeforeEach
    void prices() {
        when(ethereum.balanceOf(any(String.class)))
            .thenReturn(new EthereumBalanceClient.BalanceResult(new BigDecimal("12.5"), "VERIFIED"));
        when(marketPrices.currentPrice(any(Coin.class), nullable(String.class))).thenAnswer(invocation -> {
            Coin coin = invocation.getArgument(0);
            String requested = invocation.getArgument(1);
            String currency = requested == null ? "USD" : requested;
            return quote(coin, currency);
        });
        when(marketPrices.currentPrices(anyList(), nullable(String.class))).thenAnswer(invocation -> {
            List<Coin> coins = invocation.getArgument(0);
            String requested = invocation.getArgument(1);
            String currency = requested == null ? "KRW" : requested;
            return coins.stream().map(coin -> quote(coin, currency)).toList();
        });
    }

    @Test
    void supportsRichPostAndSocialInteractions() throws Exception {
        Account author = signup("social-author", "작성자");
        Account reader = signup("social-reader", "독자");
        wallets.save(new Wallet(members.findById(author.id()).orElseThrow(),
            "0x3333333333333333333333333333333333333333"));
        mvc.perform(get("/api/v1/me/assets").header("Authorization", bearer(author.token())))
            .andExpect(status().isOk());

        MockMultipartFile image = new MockMultipartFile("file", "chart.png", "image/png", new byte[]{1, 2, 3});
        MvcResult upload = mvc.perform(multipart("/api/v1/media").file(image).header("Authorization", bearer(author.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mediaType").value("IMAGE"))
            .andReturn();
        String mediaUrl = json.readTree(upload.getResponse().getContentAsString()).get("url").asText();

        String createBody = """
            {
              "coinSymbol":"ETH",
              "title":"ETH 차트 분석",
              "content":"지지 구간을 확인했습니다.",
              "media":[{"type":"IMAGE","url":"%s"}],
              "tradingViewSymbol":"BINANCE:ETHUSDT",
              "tradingViewInterval":"60",
              "tradingViewAnalysis":"1시간봉 지지선 관찰",
              "assetPrice":4321.25,
              "assetPriceCurrency":"USDT",
              "youtubeUrl":"https://www.youtube.com/shorts/dQw4w9WgXcQ"
            }
            """.formatted(mediaUrl);
        MvcResult created = mvc.perform(post("/api/v1/posts")
                .header("Authorization", bearer(author.token()))
                .contentType(MediaType.APPLICATION_JSON).content(createBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.media[0].type").value("IMAGE"))
            .andExpect(jsonPath("$.tradingView.symbol").value("BINANCE:ETHUSDT"))
            .andExpect(jsonPath("$.priceSnapshot.capturedAt").isNotEmpty())
            .andExpect(jsonPath("$.youtube.videoId").value("dQw4w9WgXcQ"))
            .andExpect(jsonPath("$.youtube.thumbnailUrl").value("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"))
            .andExpect(jsonPath("$.holderSnapshot.verificationAvailability").value("SUPPORTED"))
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("WALLET"))
            .andExpect(jsonPath("$.holderSnapshot.quantityBand").value("10~100 ETH"))
            .andReturn();
        String publishedPriceAt = json.readTree(created.getResponse().getContentAsString())
            .get("priceSnapshot").get("capturedAt").asText();
        long postId = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(post("/api/v1/posts/{postId}/likes", postId).header("Authorization", bearer(reader.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.likes").value(1)).andExpect(jsonPath("$.liked").value(true));
        MvcResult comment = mvc.perform(post("/api/v1/posts/{postId}/comments", postId).header("Authorization", bearer(reader.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"좋은 분석이에요\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.verificationAvailability").value("SUPPORTED"))
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("UNVERIFIED"))
            .andReturn();
        long commentId = json.readTree(comment.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(patch("/api/v1/comments/{commentId}", commentId).header("Authorization", bearer(reader.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"수정된 댓글입니다\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.content").value("수정된 댓글입니다"))
            .andExpect(jsonPath("$.updatedAt").isNotEmpty());
        mvc.perform(post("/api/v1/posts/{postId}/bookmarks", postId).header("Authorization", bearer(reader.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.bookmarked").value(true));
        mvc.perform(post("/api/v1/posts/{postId}/reposts", postId).header("Authorization", bearer(reader.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.reposted").value(true)).andExpect(jsonPath("$.reposts").value(1));
        mvc.perform(post("/api/v1/members/{memberId}/follow", author.id()).header("Authorization", bearer(reader.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.followers").value(1)).andExpect(jsonPath("$.followedByMe").value(true));

        MvcResult firstPage = mvc.perform(get("/api/v1/feed").param("size", "1").header("Authorization", bearer(reader.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].eventType").value("REPOST"))
            .andExpect(jsonPath("$.items[0].post.id").value(postId)).andExpect(jsonPath("$.hasMore").value(true))
            .andExpect(jsonPath("$.nextCursor").isNotEmpty()).andReturn();
        String cursor = json.readTree(firstPage.getResponse().getContentAsString()).get("nextCursor").asText();
        mvc.perform(get("/api/v1/feed").param("size", "1").param("cursor", cursor))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].eventType").value("POST"))
            .andExpect(jsonPath("$.items[0].post.id").value(postId));
        mvc.perform(get("/api/v1/feed/following").header("Authorization", bearer(reader.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].eventType").value("POST"))
            .andExpect(jsonPath("$.items[0].actor.id").value(author.id()));
        mvc.perform(get("/api/v1/me/bookmarks").header("Authorization", bearer(reader.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(postId));

        String updateBody = """
            {
              "title":"수정된 ETH 분석",
              "content":"수정된 내용입니다.",
              "media":[{"type":"IMAGE","url":"%s"}],
              "assetPriceCurrency":"KRW"
            }
            """.formatted(mediaUrl);
        mvc.perform(put("/api/v1/posts/{postId}", postId).header("Authorization", bearer(reader.token()))
                .contentType(MediaType.APPLICATION_JSON).content(updateBody))
            .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/posts/{postId}", postId).header("Authorization", bearer(author.token()))
                .contentType(MediaType.APPLICATION_JSON).content(updateBody))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("수정된 ETH 분석"))
            .andExpect(jsonPath("$.priceSnapshot.currency").value("USDT"))
            .andExpect(jsonPath("$.priceSnapshot.capturedAt").value(publishedPriceAt))
            .andExpect(jsonPath("$.holderSnapshot.verificationAvailability").value("SUPPORTED"));

        String fileName = mediaUrl.substring(mediaUrl.lastIndexOf('/') + 1);
        mvc.perform(delete("/api/v1/media/{fileName}", fileName).header("Authorization", bearer(author.token())))
            .andExpect(status().isConflict());

        mvc.perform(delete("/api/v1/posts/{postId}/reposts", postId).header("Authorization", bearer(reader.token())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.reposted").value(false));
        mvc.perform(delete("/api/v1/posts/{postId}", postId).header("Authorization", bearer(author.token())))
            .andExpect(status().isNoContent());
        mvc.perform(get(mediaUrl)).andExpect(status().isNotFound());

        MockMultipartFile unused = new MockMultipartFile("file", "unused.png", "image/png", new byte[]{4, 5, 6});
        MvcResult unusedUpload = mvc.perform(multipart("/api/v1/media").file(unused).header("Authorization", bearer(author.token())))
            .andExpect(status().isOk()).andReturn();
        String unusedUrl = json.readTree(unusedUpload.getResponse().getContentAsString()).get("url").asText();
        String unusedName = unusedUrl.substring(unusedUrl.lastIndexOf('/') + 1);
        mvc.perform(delete("/api/v1/media/{fileName}", unusedName).header("Authorization", bearer(reader.token())))
            .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/media/{fileName}", unusedName).header("Authorization", bearer(author.token())))
            .andExpect(status().isNoContent());
        mvc.perform(get(unusedUrl)).andExpect(status().isNotFound());

        mvc.perform(get("/api/v1/market/prices/ETH").param("currency", "KRW"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.source").value("COINGECKO"));
        mvc.perform(get("/api/v1/market/prices").param("currency", "KRW"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].symbol").value("BTC"))
            .andExpect(jsonPath("$[0].change24h").value(2.75))
            .andExpect(jsonPath("$[4].symbol").value("DOGE"));
    }

    @ParameterizedTest
    @CsvSource({"UNAVAILABLE,false", "RPC_ERROR,false", "UNAVAILABLE,true", "RPC_ERROR,true"})
    void failedRefreshRecordsUnknownInsteadOfReusingVerifiedCache(String rpcStatus, boolean savedAssets) throws Exception {
        String suffix = rpcStatus.toLowerCase() + (savedAssets ? "-saved" : "-new");
        Account author = signup("rpc-" + suffix, "RPC " + suffix);
        wallets.save(new Wallet(members.findById(author.id()).orElseThrow(),
            "0x" + java.util.UUID.randomUUID().toString().replace("-", "") + "12345678"));
        if (savedAssets) {
            mvc.perform(get("/api/v1/me/assets").header("Authorization", bearer(author.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assets[0].verified").value(true));
        }

        when(ethereum.balanceOf(any(String.class)))
            .thenReturn(new EthereumBalanceClient.BalanceResult(BigDecimal.ZERO, rpcStatus));
        mvc.perform(get("/api/v1/me/assets").header("Authorization", bearer(author.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assets[0].status").value("RPC_ERROR"))
            .andExpect(jsonPath("$.assets[0].verified").value(false));
        clearInvocations(ethereum);

        MvcResult result = mvc.perform(post("/api/v1/posts")
                .header("Authorization", bearer(author.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"coinSymbol":"ETH","title":"RPC 장애 중 작성","content":"잔액 인증과 글 작성은 독립적입니다."}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.verifiedHolder").value(false))
            .andExpect(jsonPath("$.holderSnapshot.verifiedHolder").value(false))
            .andExpect(jsonPath("$.holderSnapshot.verificationLevel").value("UNVERIFIED"))
            .andExpect(jsonPath("$.holderSnapshot.walletCount").value(1))
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("UNKNOWN"))
            .andReturn();
        JsonNode response = json.readTree(result.getResponse().getContentAsString());
        long postId = response.get("id").asLong();
        mvc.perform(get("/api/v1/posts/{postId}", postId)
                .header("Authorization", bearer(author.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.verifiedHolder").value(false));
        org.junit.jupiter.api.Assertions.assertTrue(response.get("assetValueKrw").isNull());
        mvc.perform(post("/api/v1/posts/{postId}/comments", postId)
                .header("Authorization", bearer(author.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"RPC 장애 중 댓글\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.holderSnapshot.verifiedHolder").value(false))
            .andExpect(jsonPath("$.holderSnapshot.holderStatus").value("UNKNOWN"));
        verifyNoInteractions(ethereum);
    }

    private PriceQuote quote(Coin coin, String currency) {
        return new PriceQuote(coin.getSymbol(), new BigDecimal("4321.25"), currency, new BigDecimal("2.75"),
            Instant.parse("2026-09-01T00:00:00Z"), "COINGECKO");
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
