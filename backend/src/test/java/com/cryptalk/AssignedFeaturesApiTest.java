package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.badge.BadgeService;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AssignedFeaturesApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired BadgeService badges;
    @Autowired CoinRepository coins;
    @Autowired MemberRepository members;
    @Autowired com.cryptalk.asset.AssetSnapshotRepository assetSnapshots;
    long user;
    @BeforeEach
    void setup() {
        jdbc.update("INSERT INTO members(id,role,nickname,avatar_color,asset_visibility,created_at,updated_at) VALUES(100000,'ADMIN','assigned-admin','#123456','EXACT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        user = members.saveAndFlush(new Member("needle-user", "#123456")).getId();
    }

    @Test
    void createsCategorizesAndSoftDeletesRoomsWithoutReusingSymbols() throws Exception {
        String created = mvc.perform(post("/api/v1/admin/room-categories").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Layer 2\",\"displayOrder\":0}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long category = json.readTree(created).get("id").asLong();
        String room = "{\"symbol\":\"test2\",\"name\":\"Test Room\",\"displayOrder\":50,\"categoryId\":" + category + "}";
        mvc.perform(post("/api/v1/admin/communities").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(room)).andExpect(status().isCreated())
            .andExpect(jsonPath("$.symbol").value("TEST2")).andExpect(jsonPath("$.operationStatus").value("CLOSE"));
        mvc.perform(get("/api/v1/communities/TEST2")).andExpect(status().isOk())
            .andExpect(jsonPath("$.coin.categoryId").value(category)).andExpect(jsonPath("$.coin.verificationAvailability").value("NOT_SUPPORTED"));
        mvc.perform(delete("/api/v1/admin/room-categories/{id}", category).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isConflict());
        mvc.perform(patch("/api/v1/admin/communities/TEST2/status").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"operationStatus\":\"OPEN\"}")).andExpect(status().isOk());
        String published = mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"coinSymbol\":\"TEST2\",\"title\":\"retained\",\"content\":\"body\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.priceSnapshot").doesNotExist())
            .andReturn().getResponse().getContentAsString();
        long postId = json.readTree(published).get("id").asLong();
        mvc.perform(delete("/api/v1/admin/communities/TEST2").with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/communities/TEST2")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/posts/{id}", postId)).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM posts WHERE id=?", Long.class, postId)).isEqualTo(1);
        mvc.perform(post("/api/v1/admin/communities").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(room)).andExpect(status().isConflict());
        mvc.perform(patch("/api/v1/admin/communities/TEST2").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Test\",\"displayOrder\":1,\"active\":false,\"categoryId\":null}"))
            .andExpect(status().isOk());
        mvc.perform(delete("/api/v1/admin/room-categories/{id}", category).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/admin/communities").contentType(MediaType.APPLICATION_JSON).content(room)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/room-categories").with(jwt().jwt(t -> t.subject(Long.toString(user))))).andExpect(status().isForbidden());
    }

    @Test
    void configurableBoundariesUseImmutableVersionedSnapshots() throws Exception {
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow();
        var owner = members.findById(user).orElseThrow();
        var asset = new AssetSnapshot(owner, coin);
        asset.capture(new BigDecimal("0.1"), BigDecimal.ZERO, true, "VERIFIED", 1);
        var before = badges.capture(coin, asset);
        assertThat(before.getName()).isEqualTo("물고기");
        long version = badges.get(100000L, "ETH").version();
        var config = new BadgeService.SaveRequest(version, List.of(
            new BadgeService.TierRequest("Small", BigDecimal.ZERO, "shrimp", "coral", "none"),
            new BadgeService.TierRequest("Large", new BigDecimal("0.05"), "whale", "gold", "aurora")));
        badges.save(100000L, "ETH", config);
        assertThat(badges.capture(coin, asset).getName()).isEqualTo("Large");
        assertThat(before.getName()).isEqualTo("물고기");
        assertThat(before.getQuantityBand()).isEqualTo("0.1~1 ETH");
        mvc.perform(put("/api/v1/admin/communities/ETH/badge-config").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(config))).andExpect(status().isConflict());
        config = new BadgeService.SaveRequest(version + 1, List.of(new BadgeService.TierRequest("Gap", BigDecimal.ONE, "fish", "mint", "none")));
        mvc.perform(put("/api/v1/admin/communities/ETH/badge-config").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(config))).andExpect(status().isBadRequest());
        asset.capture(BigDecimal.ZERO, BigDecimal.ZERO, false, "VERIFIED", 1);
        assertThat(badges.capture(coin, asset)).isNull();
        asset.capture(BigDecimal.ONE, BigDecimal.ZERO, true, "VERIFIED", 1);
        asset.captureSources("WALLET", 0, "PARTIAL");
        assertThat(badges.capture(coin, asset).getName()).isEqualTo("Large");
        mvc.perform(get("/api/v1/admin/badge-presets")).andExpect(status().isUnauthorized());
    }

    @Test
    void profileCoinPreferencesDoNotChangePublicationSnapshots() throws Exception {
        var owner = members.findById(user).orElseThrow();
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow();
        var asset = new AssetSnapshot(owner, coin);
        asset.capture(BigDecimal.ONE, BigDecimal.ZERO, true, "VERIFIED", 1);
        assetSnapshots.saveAndFlush(asset);
        mvc.perform(get("/api/v1/members/by-nickname/needle-user")).andExpect(status().isOk())
            .andExpect(jsonPath("$.assets.length()").value(1));
        var snapshot = new com.cryptalk.post.PostHolderSnapshot(
            new com.cryptalk.post.Post(owner, coin, "profile", "body", null, true,
                null, null, null, null, null, null, null, null, null, null), asset);
        snapshot.applyBadge(badges.capture(coin, asset));
        mvc.perform(put("/api/v1/me/asset-visibility/ETH").with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"visible\":false}")).andExpect(status().isOk())
            .andExpect(jsonPath("$.visible").value(false));
        mvc.perform(get("/api/v1/me/asset-visibility")).andExpect(status().isUnauthorized());
        assertThat(snapshot.getBadge().getName()).isEqualTo("돌고래");
        mvc.perform(get("/api/v1/members/by-nickname/needle-user")).andExpect(status().isOk())
            .andExpect(jsonPath("$.assets.length()").value(0));
    }

    @Test
    void looksUpNicknamesWithReservedUrlCharactersWithoutChangingTheirIdentity() throws Exception {
        members.saveAndFlush(new Member("고래/물고기 #1", "#123456"));
        mvc.perform(get("/api/v1/members/by-nickname").param("nickname", "고래/물고기 #1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("고래/물고기 #1"))
            .andExpect(jsonPath("$.walletAddress").doesNotExist());
        mvc.perform(get("/api/v1/members/by-nickname").param("nickname", ""))
            .andExpect(status().isBadRequest());
    }

    @Test
    void separatesSearchTypesAndHidesModeratedContentAcrossPublicApis() throws Exception {
        long coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow().getId();
        jdbc.update("INSERT INTO posts(member_id,coin_id,title,content,created_at,updated_at) VALUES(?,?,'needle-title','needle-body',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", user, coin);
        long post = jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=?", Long.class, user);
        jdbc.update("INSERT INTO comments(member_id,post_id,content,created_at) VALUES(?,?,'needle-comment',CURRENT_TIMESTAMP)", user, post);
        mvc.perform(get("/api/v1/search/groups").param("q", "needle")).andExpect(status().isOk())
            .andExpect(jsonPath("$.posts.totalElements").value(1)).andExpect(jsonPath("$.comments.totalElements").value(1))
            .andExpect(jsonPath("$.users.totalElements").value(1)).andExpect(jsonPath("$.rooms.totalElements").value(0));
        mvc.perform(get("/api/v1/search").param("q", "needle").param("type", "comments")).andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].type").value("COMMENT"));
        mvc.perform(get("/api/v1/communities/ETH/search/groups").param("q", "needle")).andExpect(status().isOk())
            .andExpect(jsonPath("$.rooms").doesNotExist());
        mvc.perform(get("/api/v1/communities/ETH/search").param("q", "needle").param("type", "users")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/admin/posts/{id}/status", post).with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true,\"reason\":\"test\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/posts/{id}", post)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/search/groups").param("q", "needle")).andExpect(status().isOk())
            .andExpect(jsonPath("$.posts.totalElements").value(0)).andExpect(jsonPath("$.comments.totalElements").value(0));
        mvc.perform(get("/api/v1/feed/page")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(patch("/api/v1/admin/posts/{id}/status", post).with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false,\"reason\":\"restored\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/posts/{id}", post)).andExpect(status().isOk());
        mvc.perform(patch("/api/v1/admin/members/{id}/status", user).with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true,\"reason\":\"test\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/v1/posts/{id}/likes", post).with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));
        mvc.perform(get("/api/v1/admin/moderation-logs").with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3));
    }
}
