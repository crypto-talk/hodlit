package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.asset.AssetService;
import com.cryptalk.coin.Coin;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.media.MediaAssetRepository;
import com.cryptalk.media.MediaService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

@SpringBootTest
@AutoConfigureMockMvc
class DraftApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired MediaAssetRepository assets;
    @Autowired MediaService media;
    @Autowired PlatformTransactionManager transactions;
    @Autowired com.cryptalk.draft.DraftService drafts;
    @Autowired com.cryptalk.draft.DraftRepository draftRows;
    @MockitoBean AssetService snapshots;
    @MockitoBean MarketPriceService prices;
    long owner;
    long other;

    @BeforeEach
    void setup() {
        owner = members.save(new Member(UUID.randomUUID().toString(), "blue")).getId();
        other = members.save(new Member(UUID.randomUUID().toString(), "red")).getId();
        when(prices.currentPrice(any(Coin.class), nullable(String.class))).thenReturn(
            new MarketPriceService.PriceQuote("ETH", new BigDecimal("100"), "USD", BigDecimal.ZERO, Instant.now(), "TEST"));
    }

    @Test
    void emptyDraftCrudAndRecentOrderPreserveMarkdownWithoutSnapshots() throws Exception {
        long first = create("{}");
        long second = create("{\"coinSymbol\":\"\",\"title\":\"\",\"content\":\"\"}");
        mvc.perform(auth(get("/api/v1/drafts"), owner)).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(second));
        String body = "{\"title\":\"  title  \",\"content\":\"# Markdown\\n\\n  **raw**  \",\"youtubeUrl\":\"https://youtu\"}";
        mvc.perform(auth(put("/api/v1/drafts/{id}", first), owner).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.updatedAt").isNotEmpty());
        mvc.perform(auth(get("/api/v1/drafts/{id}", first), owner)).andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("  title  "))
            .andExpect(jsonPath("$.content").value("# Markdown\n\n  **raw**  "));
        mvc.perform(auth(get("/api/v1/drafts"), owner)).andExpect(jsonPath("$[0].id").value(first));
        mvc.perform(auth(put("/api/v1/drafts/{id}", first), owner).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").doesNotExist());
        mvc.perform(auth(delete("/api/v1/drafts/{id}", first), owner)).andExpect(status().isNoContent());
        mvc.perform(auth(get("/api/v1/drafts/{id}", first), owner)).andExpect(status().isNotFound());
        verifyNoInteractions(snapshots, prices);
    }

    @Test
    void requiresAuthenticationAndOwnershipForEveryEndpoint() throws Exception {
        long id = create("{}");
        for (var request : java.util.List.of(get("/api/v1/drafts"), get("/api/v1/drafts/{id}", id),
                post("/api/v1/drafts"), put("/api/v1/drafts/{id}", id), delete("/api/v1/drafts/{id}", id))) {
            mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        }
        for (var request : java.util.List.of(get("/api/v1/drafts/{id}", id), put("/api/v1/drafts/{id}", id),
                delete("/api/v1/drafts/{id}", id))) {
            mvc.perform(auth(request, other).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        }
        mvc.perform(auth(get("/api/v1/drafts"), other)).andExpect(jsonPath("$").isEmpty());
        mvc.perform(auth(put("/api/v1/drafts/9999999"), owner).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isNotFound());
        mvc.perform(auth(delete("/api/v1/drafts/9999999"), owner)).andExpect(status().isNotFound());
    }

    @Test
    void enforcesQuotaAndFieldValidation() throws Exception {
        for (int i = 0; i < 10; i++) create("{}");
        mvc.perform(auth(post("/api/v1/drafts"), owner).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isConflict());
        mvc.perform(auth(post("/api/v1/drafts"), other).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated());
        long id = json.readTree(mvc.perform(auth(get("/api/v1/drafts"), owner)).andReturn()
            .getResponse().getContentAsString()).get(0).get("id").asLong();
        for (String body : java.util.List.of(json.writeValueAsString(java.util.Map.of("title", "x".repeat(121))),
                json.writeValueAsString(java.util.Map.of("content", "x".repeat(5001))),
                "{\"media\":[null]}", "{\"media\":[{\"type\":\"IMAGE\",\"url\":\"http://example.com/a\"}]}",
                "{\"media\":[{\"url\":\"https://example.com/a\"}]}",
                "{\"media\":[{\"type\":\"IMAGE\",\"url\":\"/api/v1/media/bad\"}]}",
                "{\"media\":[" + String.join(",", java.util.Collections.nCopies(9,
                    "{\"type\":\"IMAGE\",\"url\":\"https://example.com/a\"}")) + "]}")) {
            mvc.perform(auth(put("/api/v1/drafts/{id}", id), owner).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        }
    }

    @Test
    void concurrentCreationCannotExceedQuota() throws Exception {
        for (int i = 0; i < 9; i++) create("{}");
        var request = json.readValue("{}", com.cryptalk.draft.DraftDtos.SaveDraftRequest.class);
        var start = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            java.util.concurrent.Callable<Boolean> create = () -> {
                start.await();
                try { drafts.create(owner, request); return true; }
                catch (com.cryptalk.common.ApiException expected) {
                    assertThat(expected.status()).isEqualTo(org.springframework.http.HttpStatus.CONFLICT);
                    return false;
                }
            };
            var first = executor.submit(create);
            var second = executor.submit(create);
            start.countDown();
            assertThat(java.util.List.of(first.get(10, java.util.concurrent.TimeUnit.SECONDS),
                second.get(10, java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
        }
        assertThat(draftRows.countByMemberId(owner)).isEqualTo(10);
    }

    @Test
    void protectsUploadsAndTransfersThemOnPublicationThenDeletesOnlyDraft() throws Exception {
        String url = upload(owner);
        String body = "{\"coinSymbol\":\"ETH\",\"title\":\"publish\",\"content\":\"body\",\"media\":[{\"type\":\"IMAGE\",\"url\":\"%s\"}]}".formatted(url);
        long id = create(body);
        String file = url.substring("/api/v1/media/".length());
        assertThat(assets.findById(file).orElseThrow().getDraftId()).isEqualTo(id);
        mvc.perform(auth(delete(url), owner)).andExpect(status().isConflict());
        new TransactionTemplate(transactions).executeWithoutResult(status -> media.deleteManagedAfterCommit(java.util.List.of(url)));
        mvc.perform(get(url)).andExpect(status().isOk());
        mvc.perform(auth(post("/api/v1/posts"), owner).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.media[0].url").value(url));
        assertThat(assets.findById(file).orElseThrow().getDraftId()).isNull();
        mvc.perform(auth(delete("/api/v1/drafts/{id}", id), owner)).andExpect(status().isNoContent());
        mvc.perform(get(url)).andExpect(status().isOk());
        mvc.perform(auth(delete(url), owner)).andExpect(status().isConflict());
        verify(snapshots).snapshotForPublication(any(Long.class), any(Coin.class));
        verify(prices).currentPrice(any(Coin.class), nullable(String.class));
    }

    @Test
    void releasesMediaOnReplacementAndRejectsOtherOwnersAndDuplicateClaims() throws Exception {
        String url = upload(owner);
        String body = "{\"media\":[{\"type\":\"IMAGE\",\"url\":\"%s\",\"thumbnailUrl\":\"%s\"}]}".formatted(url, upload(other));
        mvc.perform(auth(post("/api/v1/drafts"), owner).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isForbidden());
        assertThat(assets.findById(url.substring(14)).orElseThrow().getDraftId()).isNull();
        body = "{\"media\":[{\"type\":\"IMAGE\",\"url\":\"%s\"}]}".formatted(url);
        long id = create(body);
        mvc.perform(auth(post("/api/v1/drafts"), owner).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isConflict());
        mvc.perform(auth(put("/api/v1/drafts/{id}", id), owner).contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isOk());
        mvc.perform(auth(delete(url), owner)).andExpect(status().isNoContent());
        mvc.perform(get(url)).andExpect(status().isNotFound());
    }

    private long create(String body) throws Exception {
        return json.readTree(mvc.perform(auth(post("/api/v1/drafts"), owner).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
    }
    private String upload(long member) throws Exception {
        return json.readTree(mvc.perform(multipart("/api/v1/media").file(new MockMultipartFile("file", "a.png", "image/png", new byte[]{1, 2, 3}))
            .with(jwt().jwt(token -> token.subject(Long.toString(member)))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("url").asText();
    }
    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request, long member) {
        return request.with(jwt().jwt(token -> token.subject(Long.toString(member))));
    }
}
