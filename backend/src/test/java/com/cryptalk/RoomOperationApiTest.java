package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.RoomOperationStatus;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import java.sql.Timestamp;
import java.time.Instant;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RoomOperationApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    @Autowired MemberRepository members;
    @Autowired CoinRepository coins;
    long user;

    @BeforeEach
    void setup() {
        jdbc.update("INSERT INTO members(id,role,nickname,avatar_color,asset_visibility,created_at,updated_at) VALUES(100000,'ADMIN','room-admin','#123456','EXACT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        user = members.saveAndFlush(new Member("room-user", "#123456")).getId();
    }

    @Test
    void databaseRoleGrantAndRevocationApplyWithTheSameToken() throws Exception {
        String subject = Long.toString(user);
        String path = "/api/v1/admin/communities";
        assertThat(jdbc.queryForObject("SELECT role FROM members WHERE id=?", String.class, user)).isEqualTo("USER");
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(subject).claim("role", "ADMIN"))))
            .andExpect(status().isForbidden());
        jdbc.update("UPDATE members SET role='ADMIN' WHERE id=?", user);
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(subject))))
            .andExpect(status().isOk());
        jdbc.update("UPDATE members SET role='USER' WHERE id=?", user);
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(subject))))
            .andExpect(status().isForbidden());
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject("999999999"))))
            .andExpect(status().isForbidden());
    }

    @Test
    void initializesEthAndOtherOpenAndKeepsClosedRoomsDiscoverable() throws Exception {
        assertThat(coins.findByActiveTrueOrderByDisplayOrder().stream()
            .filter(c -> c.getOperationStatus() == RoomOperationStatus.OPEN).map(c -> c.getSymbol()).toList())
            .containsExactly("ETH", "OTHER");
        mvc.perform(get("/api/v1/coins")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(21))
            .andExpect(jsonPath("$[0].operationStatus").value("CLOSE"));
        mvc.perform(get("/api/v1/coins/page")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(21))
            .andExpect(jsonPath("$.items[0].operationStatus").value("CLOSE"));
        mvc.perform(get("/api/v1/communities/BTC")).andExpect(status().isOk())
            .andExpect(jsonPath("$.coin.operationStatus").value("CLOSE")).andExpect(jsonPath("$.postCount").value(0));
        mvc.perform(get("/api/v1/communities/ETH")).andExpect(status().isOk())
            .andExpect(jsonPath("$.coin.operationStatus").value("OPEN"));
    }

    @Test
    void otherRoomMetadataAndPaginationKeepTheGeneralRoomLast() throws Exception {
        jdbc.update("UPDATE coins SET display_order=0 WHERE symbol='OTHER'");
        mvc.perform(get("/api/v1/coins"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[20].symbol").value("OTHER"));
        mvc.perform(get("/api/v1/coins/page").param("page", "1").param("size", "20"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].symbol").value("OTHER"));
        mvc.perform(get("/api/v1/communities/other"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.coin.name").value("기타"))
            .andExpect(jsonPath("$.coin.operationStatus").value("OPEN"))
            .andExpect(jsonPath("$.coin.verificationAvailability").value("NOT_SUPPORTED"))
            .andExpect(jsonPath("$.coin.chainId").doesNotExist())
            .andExpect(jsonPath("$.coin.assetType").doesNotExist());
    }

    @Test
    void otherRoomDoesNotOfferPricesNewsPollsOrAssetVisibilitySettings() throws Exception {
        mvc.perform(get("/api/v1/market/prices/OTHER")).andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/v1/communities/OTHER/news")).andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/v1/communities/OTHER/poll")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/communities/OTHER/polls/results")).andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(post("/api/v1/communities/OTHER/news").with(jwt().jwt(t -> t.subject("100000")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"제목\",\"summary\":\"요약\",\"sourceName\":\"출처\",\"sourceUrl\":\"https://example.com/article\"}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("ROOM_FEATURE_UNSUPPORTED"));
        mvc.perform(post("/api/v1/communities/OTHER/polls").with(jwt().jwt(t -> t.subject("100000")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"투표\",\"choices\":[\"상승\",\"하락\"]}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("ROOM_FEATURE_UNSUPPORTED"));
        mvc.perform(get("/api/v1/me/asset-visibility").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.symbol == 'OTHER')]").isEmpty());
        mvc.perform(put("/api/v1/me/asset-visibility/OTHER").with(jwt().jwt(t -> t.subject(Long.toString(user))))
                .contentType(MediaType.APPLICATION_JSON).content("{\"visible\":false}"))
            .andExpect(status().isNotFound());
    }

    @Test
    void migrationReusesAnExistingOtherRoomAndItsPosts() throws Exception {
        long roomId = coins.findBySymbolIgnoreCaseAndActiveTrue("OTHER").orElseThrow().getId();
        long postId = insertPost("OTHER", "기존 기타 방 글");
        jdbc.update("""
            UPDATE coins SET symbol='other', name='기존 방', active=FALSE, operation_status='CLOSE',
                verification_availability='SUPPORTED', market_price_id='legacy-price', chain_id=1
            WHERE id=?
            """, roomId);

        var migration = new ResourceDatabasePopulator(new ClassPathResource("db/changelog/025-other-room.sql"));
        migration.execute(dataSource);

        assertThat(jdbc.queryForList("SELECT id FROM coins WHERE UPPER(symbol)='OTHER'", Long.class))
            .containsExactly(roomId);
        assertThat(jdbc.queryForObject("SELECT market_price_id FROM coins WHERE id=?", String.class, roomId)).isNull();
        assertThat(jdbc.queryForObject("SELECT verification_availability FROM coins WHERE id=?", String.class, roomId))
            .isEqualTo("NOT_SUPPORTED");
        assertThat(jdbc.queryForObject("SELECT operation_status FROM coins WHERE id=?", String.class, roomId))
            .isEqualTo("OPEN");
        assertThat(jdbc.queryForObject("SELECT coin_id FROM posts WHERE id=?", Long.class, postId)).isEqualTo(roomId);
    }

    @Test
    void requiresServiceAdminAndValidatesManagementRequests() throws Exception {
        String path = "/api/v1/admin/communities";
        String state = "{\"operationStatus\":\"OPEN\"}";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(patch(path + "/BTC/status").contentType(MediaType.APPLICATION_JSON).content(state))
            .andExpect(status().isUnauthorized());
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject(Long.toString(user))))).andExpect(status().isForbidden());
        mvc.perform(patch(path + "/BTC/status").with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content(state)).andExpect(status().isForbidden());
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject("100000"))).param("operationStatus", "CLOSE").param("size", "3"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(19))
            .andExpect(jsonPath("$.items.length()").value(3)).andExpect(jsonPath("$.totalPages").value(7));
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject("100000"))).param("q", "eTh"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].symbol").value("ETH"));
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject("100000"))).param("q", "%"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        for (String invalid : new String[] {"close", "UNDER_CONSTRUCTION", ""}) {
            mvc.perform(patch(path + "/BTC/status").with(jwt().jwt(t -> t.subject("100000")))
                .contentType(MediaType.APPLICATION_JSON).content("{\"operationStatus\":\"" + invalid + "\"}"))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject("100000"))).param("operationStatus", "INVALID"))
            .andExpect(status().isBadRequest());
        mvc.perform(get(path).with(jwt().jwt(t -> t.subject("100000"))).param("size", "101"))
            .andExpect(status().isBadRequest());
        mvc.perform(patch(path + "/MISSING/status").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(state)).andExpect(status().isNotFound());
    }

    @Test
    void closesDirectAccessAndParticipationThenReopensWithoutDeletingContent() throws Exception {
        long post = insertPost("ETH", "retained-content");
        jdbc.update("INSERT INTO comments(post_id,member_id,content,created_at) VALUES(?,?,?,CURRENT_TIMESTAMP)", post, user, "retained-comment");
        long comment = jdbc.queryForObject("SELECT MAX(id) FROM comments WHERE post_id=?", Long.class, post);
        change("ETH", "CLOSE");
        assertThat(coins.findBySymbolIgnoreCaseAndActiveTrue("ETH")).isPresent();
        mvc.perform(get("/api/v1/me/assets").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk());
        for (String path : new String[] {"/api/v1/communities/ETH/posts", "/api/v1/communities/ETH/posts/page",
                "/api/v1/posts/" + post, "/api/v1/posts/" + post + "/comments", "/api/v1/posts/" + post + "/comments/page",
                "/api/v1/communities/ETH/stats", "/api/v1/communities/ETH/news", "/api/v1/communities/ETH/poll"}) {
            closed(mvc.perform(get(path)));
        }
        closed(mvc.perform(get("/api/v1/communities/ETH/search").param("q", "retained")));
        closed(mvc.perform(post("/api/v1/posts").with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"coinSymbol\":\"ETH\",\"title\":\"new\",\"content\":\"body\"}")));
        closed(mvc.perform(put("/api/v1/posts/{id}", post).with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"changed\",\"content\":\"body\"}")));
        closed(mvc.perform(delete("/api/v1/posts/{id}", post).with(jwt().jwt(t -> t.subject(Long.toString(user))))));
        closed(mvc.perform(post("/api/v1/posts/{id}/comments", post).with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"blocked\"}")));
        closed(mvc.perform(patch("/api/v1/comments/{id}", comment).with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"blocked\"}")));
        closed(mvc.perform(delete("/api/v1/comments/{id}", comment).with(jwt().jwt(t -> t.subject(Long.toString(user))))));
        for (String action : new String[] {"likes", "bookmarks", "reposts"}) {
            closed(mvc.perform(post("/api/v1/posts/{id}/" + action, post).with(jwt().jwt(t -> t.subject(Long.toString(user))))));
            closed(mvc.perform(delete("/api/v1/posts/{id}/" + action, post).with(jwt().jwt(t -> t.subject(Long.toString(user))))));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM post_view_events WHERE post_id=?", Long.class, post)).isZero();
        assertThat(jdbc.queryForObject("SELECT title FROM posts WHERE id=?", String.class, post)).isEqualTo("retained-content");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM comments WHERE post_id=?", Long.class, post)).isEqualTo(1);
        change("ETH", "OPEN");
        change("ETH", "OPEN"); // Idempotent state update.
        mvc.perform(get("/api/v1/posts/{id}", post)).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("retained-content"));
        mvc.perform(get("/api/v1/posts/{id}/comments", post)).andExpect(status().isOk()).andExpect(jsonPath("$[0].content").value("retained-comment"));
        mvc.perform(post("/api/v1/posts/{id}/likes", post).with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.likes").value(1));
    }

    @Test
    void excludesClosedContentBeforePaginationAndRestoresItAfterOpening() throws Exception {
        long eth = insertPost("ETH", "operation-needle");
        long btc = 0;
        for (int i = 0; i < 25; i++) btc = insertPost("BTC", "operation-needle");
        jdbc.update("INSERT INTO comments(post_id,member_id,content,created_at) VALUES(?,?,?,CURRENT_TIMESTAMP)", btc, user, "operation-needle");
        jdbc.update("INSERT INTO post_reposts(post_id,member_id,created_at) VALUES(?,?,CURRENT_TIMESTAMP)", btc, user);
        for (long id : new long[] {eth, btc}) jdbc.update("INSERT INTO post_bookmarks(post_id,member_id,created_at) VALUES(?,?,CURRENT_TIMESTAMP)", id, user);
        jdbc.update("INSERT INTO member_follows(follower_id,following_id,created_at) VALUES(100000,?,CURRENT_TIMESTAMP)", user);
        for (String path : new String[] {"/api/v1/posts/page", "/api/v1/feed/page"}) {
            mvc.perform(get(path).param("size", "1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items.length()").value(1));
        }
        mvc.perform(get("/api/v1/feed")).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.items[0].post.coinSymbol").value("ETH"));
        mvc.perform(get("/api/v1/feed/following").with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get("/api/v1/feed/following/page").with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/search").param("q", "operation-needle"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/me/bookmarks/page").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/me/bookmarks").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/v1/communities/stats").param("window", "all"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rooms[*].symbol")
                .value(org.hamcrest.Matchers.contains("ETH", "OTHER")));
        change("BTC", "OPEN");
        mvc.perform(get("/api/v1/feed/page")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(27));
        mvc.perform(get("/api/v1/search").param("q", "operation-needle"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(27));
        mvc.perform(get("/api/v1/me/bookmarks/page").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/communities/stats").param("window", "all"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rooms[*].symbol")
                .value(org.hamcrest.Matchers.contains("BTC", "ETH", "OTHER")));
    }

    @Test
    void closedRoomBlocksPollReadsAndVotingUntilReopened() throws Exception {
        mvc.perform(post("/api/v1/communities/ETH/polls").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"question\":\"Direction?\",\"choices\":[\"Up\",\"Down\"]}"))
            .andExpect(status().isCreated());
        long poll = jdbc.queryForObject("SELECT MAX(id) FROM community_polls", Long.class);
        long choice = jdbc.queryForObject("SELECT MIN(id) FROM poll_choices WHERE poll_id=?", Long.class, poll);
        change("ETH", "CLOSE");
        closed(mvc.perform(get("/api/v1/polls/{id}", poll)));
        closed(mvc.perform(post("/api/v1/polls/{id}/votes", poll).with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":" + choice + "}")));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM poll_votes WHERE poll_id=?", Long.class, poll)).isZero();
        change("ETH", "OPEN");
        mvc.perform(post("/api/v1/polls/{id}/votes", poll).with(jwt().jwt(t -> t.subject(Long.toString(user))))
            .contentType(MediaType.APPLICATION_JSON).content("{\"choiceId\":" + choice + "}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.participatedToday").value(true));
    }

    private long insertPost(String symbol, String title) {
        long coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).orElseThrow().getId();
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO posts(member_id,coin_id,title,content,created_at,updated_at) VALUES(?,?,?,?,?,?)", user, coin, title, "body", now, now);
        return jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=?", Long.class, user);
    }

    private void change(String symbol, String state) throws Exception {
        mvc.perform(patch("/api/v1/admin/communities/{symbol}/status", symbol).with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"operationStatus\":\"" + state + "\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.operationStatus").value(state));
    }

    private void closed(ResultActions result) throws Exception {
        result.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ROOM_CLOSED"))
            .andExpect(jsonPath("$.message").value("현재 닫힌 방입니다.")).andExpect(jsonPath("$.timestamp").isString());
    }
}
