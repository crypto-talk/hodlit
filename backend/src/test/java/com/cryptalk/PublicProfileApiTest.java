package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.asset.AlchemyPortfolioClient;
import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.asset.AssetSnapshotRepository;
import com.cryptalk.coin.Coin;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.comment.Comment;
import com.cryptalk.comment.CommentHolderSnapshot;
import com.cryptalk.comment.CommentHolderSnapshotRepository;
import com.cryptalk.comment.CommentRepository;
import com.cryptalk.member.AssetVisibility;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.post.Post;
import com.cryptalk.post.PostHolderSnapshot;
import com.cryptalk.post.PostHolderSnapshotRepository;
import com.cryptalk.post.PostRepository;
import com.cryptalk.wallet.Wallet;
import com.cryptalk.wallet.WalletRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PublicProfileApiTest {
    private static final String ADDRESS = "0x1111111111111111111111111111111111111111";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MemberRepository members;
    @Autowired CoinRepository coins;
    @Autowired PostRepository posts;
    @Autowired CommentRepository comments;
    @Autowired AssetSnapshotRepository assets;
    @Autowired PostHolderSnapshotRepository postSnapshots;
    @Autowired CommentHolderSnapshotRepository commentSnapshots;
    @Autowired WalletRepository wallets;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @MockitoBean AlchemyPortfolioClient alchemy;
    Member owner;
    Member other;
    Coin eth;

    @BeforeEach
    void setup() {
        owner = members.saveAndFlush(new Member("private-login@example.test", "private-password-hash", "공개회원", "#123456"));
        other = members.saveAndFlush(new Member("다른회원", "#654321"));
        eth = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow();
        wallets.saveAndFlush(new Wallet(owner, ADDRESS));
    }

    @ParameterizedTest
    @EnumSource(value = AssetVisibility.class, names = {"EXACT", "RANGE"})
    void publicLookupUsesOnlyCoarseCachedAssetsEvenForExactVisibility(AssetVisibility visibility) throws Exception {
        owner.changeAssetVisibility(visibility);
        asset("ETH", "3.141592", true, "PARTIAL");
        asset("BTC", "0", false, "READY");
        asset("SOL", "500", true, "STALE");
        mvc.perform(get("/api/v1/members/by-nickname/{nickname}", owner.getNickname()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(owner.getId()))
            .andExpect(jsonPath("$.nickname").value("공개회원"))
            .andExpect(jsonPath("$.avatarColor").value("#123456"))
            .andExpect(jsonPath("$.joinedAt").isString())
            .andExpect(jsonPath("$.assets.length()").value(1))
            .andExpect(jsonPath("$.assets[0].coinSymbol").value("ETH"))
            .andExpect(jsonPath("$.assets[0].quantityBand").value("1~10 ETH"))
            .andExpect(jsonPath("$.assets[0].holdingMonths").value(3))
            .andExpect(jsonPath("$.assets[0].syncStatus").value("PARTIAL"));
        assertPrivateFieldsAbsent("/api/v1/members/by-nickname/" + owner.getNickname());
        verifyNoInteractions(alchemy);
    }

    @Test
    void activityFiltersBeforePaginationAndCountsMatchIncludingReplies() throws Exception {
        Post first = post(owner, eth, "first");
        Post second = post(owner, eth, "second");
        Post otherPost = post(other, eth, "other");
        Coin btc = coins.findBySymbolIgnoreCaseAndActiveTrue("BTC").orElseThrow();
        Post closed = post(owner, btc, "closed");
        comments.saveAndFlush(new Comment(closed, owner, "closed-comment"));
        Comment root = comments.saveAndFlush(new Comment(otherPost, owner, "root"));
        Comment reply = comments.saveAndFlush(new Comment(otherPost, owner, "reply", root));
        comments.saveAndFlush(new Comment(first, other, "other-comment"));
        // Stable pagination when timestamps tie: IDs are the second descending key.
        jdbc.update("UPDATE posts SET created_at=? WHERE member_id=?", Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")), owner.getId());
        jdbc.update("UPDATE comments SET created_at=? WHERE member_id=?", Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")), owner.getId());
        em.clear();
        mvc.perform(get("/api/v1/members/by-nickname/{nickname}", owner.getNickname()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.postCount").value(2))
            .andExpect(jsonPath("$.commentCount").value(2));
        mvc.perform(get("/api/v1/members/{id}/posts/page", owner.getId()).param("size", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.hasNext").value(true))
            .andExpect(jsonPath("$.items[0].id").value(second.getId()));
        mvc.perform(get("/api/v1/members/{id}/posts/page", owner.getId()).param("size", "1").param("page", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.hasNext").value(false))
            .andExpect(jsonPath("$.hasPrevious").value(true)).andExpect(jsonPath("$.items[0].id").value(first.getId()));
        mvc.perform(get("/api/v1/members/{id}/comments/page", owner.getId()).param("size", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.items[0].id").value(reply.getId()))
            .andExpect(jsonPath("$.items[0].postId").value(otherPost.getId()))
            .andExpect(jsonPath("$.items[0].postTitle").value("other"))
            .andExpect(jsonPath("$.items[0].parentCommentId").value(root.getId()));
        jdbc.update("UPDATE coins SET active=FALSE WHERE id=?", eth.getId());
        em.clear();
        mvc.perform(get("/api/v1/members/{id}/comments/page", owner.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/members/by-nickname/{nickname}", owner.getNickname()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.postCount").value(0))
            .andExpect(jsonPath("$.commentCount").value(0));
    }

    @Test
    void snapshotsStayFrozenAndHiddenVisibilityMasksAllProfileHoldings() throws Exception {
        AssetSnapshot cached = asset("ETH", "3.141592", true, "READY");
        Post post = post(owner, eth, "snapshot-post");
        Comment comment = comments.saveAndFlush(new Comment(post, owner, "snapshot-comment"));
        postSnapshots.saveAndFlush(new PostHolderSnapshot(post, cached));
        commentSnapshots.saveAndFlush(new CommentHolderSnapshot(comment, cached));
        cached.capture(new BigDecimal("50"), new BigDecimal("99999999"), true, "VERIFIED", 1);
        assets.flush();
        mvc.perform(get("/api/v1/members/{id}/posts/page", owner.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].holderSnapshot.quantityBand").value("1~10 ETH"));
        mvc.perform(get("/api/v1/members/{id}/comments/page", owner.getId()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].holderSnapshot.verifiedHolder").value(true))
            .andExpect(jsonPath("$.items[0].holderSnapshot.quantityBand").doesNotExist());
        assertPrivateFieldsAbsent("/api/v1/members/" + owner.getId() + "/posts/page");
        assertPrivateFieldsAbsent("/api/v1/members/" + owner.getId() + "/comments/page");
        owner.changeAssetVisibility(AssetVisibility.HIDDEN);
        members.flush();
        mvc.perform(get("/api/v1/members/by-nickname/{nickname}", owner.getNickname()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.assets").isEmpty());
        for (String type : List.of("posts", "comments")) {
            mvc.perform(get("/api/v1/members/{id}/" + type + "/page", owner.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].holderSnapshot").isEmpty());
        }
        assertThat(postSnapshots.findById(post.getId()).orElseThrow().getQuantityBand()).isEqualTo("1~10 ETH");
    }

    @Test
    void validatesPaginationReturnsNotFoundAndKeepsPrivateEndpointsAuthenticated() throws Exception {
        for (String type : List.of("posts", "comments")) {
            String path = "/api/v1/members/" + owner.getId() + "/" + type + "/page";
            mvc.perform(get(path)).andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.totalElements").value(0));
            for (String[] pair : new String[][] {{"page", "-1"}, {"page", "abc"}, {"page", "2147483648"},
                    {"page", "2147483647"}, {"size", "0"}, {"size", "101"}, {"size", "abc"}}) {
                mvc.perform(get(path).param(pair[0], pair[1])).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").isString()).andExpect(jsonPath("$.timestamp").isString());
            }
            mvc.perform(get("/api/v1/members/{id}/" + type + "/page", Long.MAX_VALUE))
                .andExpect(status().isNotFound());
            mvc.perform(get("/api/v1/members/abc/" + type + "/page")).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/v1/members/by-nickname/missing")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/me/assets")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/v1/me/asset-visibility").contentType(MediaType.APPLICATION_JSON)
            .content("{\"visibility\":\"HIDDEN\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/members/by-nickname/{nickname}", owner.getNickname())
            .with(jwt().jwt(token -> token.subject(other.getId().toString()))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(owner.getId()));
    }

    @Test
    void nicknameChangesUseCurrentNicknameAndLegacyActivityHasNoInventedSnapshot() throws Exception {
        Post post = post(owner, eth, "legacy");
        comments.saveAndFlush(new Comment(post, owner, "legacy-comment"));
        owner.update("새닉네임", owner.getAvatarColor());
        members.flush();
        mvc.perform(get("/api/v1/members/by-nickname/공개회원")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/members/by-nickname/새닉네임")).andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(owner.getId()));
        for (String type : List.of("posts", "comments")) {
            mvc.perform(get("/api/v1/members/{id}/" + type + "/page", owner.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].holderSnapshot").isEmpty());
            mvc.perform(get("/api/v1/members/{id}/" + type + "/page", owner.getId()).param("page", "9"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(1));
        }
    }

    private AssetSnapshot asset(String symbol, String quantity, boolean verified, String sync) {
        Coin coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).orElseThrow();
        AssetSnapshot asset = new AssetSnapshot(owner, coin);
        asset.capture(new BigDecimal(quantity), new BigDecimal("12345678"), verified, "VERIFIED", 1);
        asset.captureSources(verified ? "WALLET" : "UNVERIFIED", 0, sync);
        assets.saveAndFlush(asset);
        jdbc.update("UPDATE asset_snapshots SET holding_since=DATEADD('MONTH', -3, captured_at) WHERE member_id=? AND coin_id=?", owner.getId(), coin.getId());
        em.refresh(asset);
        return asset;
    }

    private Post post(Member author, Coin coin, String title) {
        return posts.saveAndFlush(new Post(author, coin, title, "body", new BigDecimal("12345678"), true,
            null, null, null, null, null, null, null, null, null, null));
    }

    private void assertPrivateFieldsAbsent(String path) throws Exception {
        String body = mvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(ADDRESS, "3.141592", "12345678", "99999999", "private-login", "private-password");
        for (String key : List.of("walletAddress", "address", "loginId", "passwordHash", "quantity", "quantityExact",
                "valueKrw", "assetValueKrw", "holdingSince")) {
            assertThat(json.readTree(body).findValues(key)).as(key).isEmpty();
        }
    }
}
