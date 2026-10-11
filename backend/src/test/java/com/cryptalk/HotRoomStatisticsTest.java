package com.cryptalk;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.CommunityStatisticsService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class HotRoomStatisticsTest {
    private static final Instant NOW = Instant.parse("2026-10-11T06:00:00Z");
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired CoinRepository coins;
    @Autowired CommunityStatisticsService statistics;
    @MockitoBean(name = "communityStatisticsClock") Clock clock;

    @BeforeEach
    void fixTime() { when(clock.instant()).thenReturn(NOW); }

    @Test
    void oneMemberIsScoredOnceAcrossPostsCommentsAndLikesAndViewsDoNotIncreaseScore() throws Exception {
        long author = member();
        long commenter = member();
        long viewer = member();
        for (int i = 0; i < 100; i++) post("ETH", author, NOW.minus(Duration.ofHours(8)));
        long oldPost = post("ETH", author, NOW.minus(Duration.ofHours(25)));
        comment(oldPost, author, NOW.minus(Duration.ofHours(3)));
        like(oldPost, author, NOW.minus(Duration.ofMinutes(10)));
        comment(oldPost, commenter, NOW.minus(Duration.ofHours(3)));
        for (int i = 0; i < 10; i++) view(oldPost, viewer, NOW.minusSeconds(1));
        view(oldPost, null, NOW.minusSeconds(1));

        var room = room("ETH");
        assertEquals(5, room.hotScore()); // author 3 + commenter 2; views add no points.
        assertEquals(2, room.activeParticipantCount());
        assertEquals(3, room.participantCount()); // Existing metric still includes logged-in viewers.
        assertEquals(100, room.postCount());
        assertEquals(2, room.commentCount());
        assertEquals(1, room.likeCount());
        assertEquals(11, room.viewCount());
        assertEquals(NOW.minus(Duration.ofMinutes(10)), room.lastActivityAt());
        mvc.perform(get("/api/v1/communities/stats"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rooms.length()").value(1))
            .andExpect(jsonPath("$.rooms[0].hotScore").value(5))
            .andExpect(jsonPath("$.rooms[0].activeParticipantCount").value(2));
    }

    @Test
    void activityIsIndependentPerRoomAndMoreRecentPeopleBeatOlderPeople() {
        long shared = member();
        post("ETH", shared, NOW.minusSeconds(1));
        post("ETH", member(), NOW.minusSeconds(1));
        post("BTC", shared, NOW.minus(Duration.ofHours(8)));
        post("BTC", member(), NOW.minus(Duration.ofHours(8)));
        post("BTC", member(), NOW.minus(Duration.ofHours(8)));
        assertEquals(List.of("ETH", "BTC"), symbols());
        assertEquals(6, room("ETH").hotScore());
        assertEquals(3, room("BTC").hotScore());
        assertEquals(2, room("ETH").activeParticipantCount());
        assertEquals(3, room("BTC").activeParticipantCount());
    }

    @Test
    void tiesUseActiveMemberCountThenLatestActivityThenDisplayOrder() {
        // Equal scores: more contributors take precedence over a newer latest activity.
        post("ETH", member(), NOW.minusSeconds(1)); // 3 points, 1 member
        for (int i = 0; i < 3; i++) post("BTC", member(), NOW.minus(Duration.ofHours(8))); // 3 points, 3 members
        assertEquals(List.of("BTC", "ETH"), symbols());
        jdbc.update("DELETE FROM posts");

        post("BTC", member(), NOW.minus(Duration.ofMinutes(30)));
        post("ETH", member(), NOW.minus(Duration.ofMinutes(10)));
        assertEquals(List.of("ETH", "BTC"), symbols());
        jdbc.update("DELETE FROM posts");

        // Use controlled display orders rather than relying on seed order.
        jdbc.update("UPDATE coins SET display_order=50 WHERE symbol='ETH'");
        jdbc.update("UPDATE coins SET display_order=60 WHERE symbol='BTC'");
        post("BTC", member(), NOW.minusSeconds(1));
        post("ETH", member(), NOW.minusSeconds(1));
        assertEquals(List.of("ETH", "BTC"), symbols());
    }

    @Test
    void viewOnlyEmptyOldAndInactiveRoomsAreExcludedButIndividualAndCumulativeStatsRemainAvailable() throws Exception {
        long btcPost = post("BTC", member(), NOW.minus(Duration.ofHours(25)));
        view(btcPost, member(), NOW.minusSeconds(1));
        post("ETH", member(), NOW.minusSeconds(1));
        jdbc.update("UPDATE coins SET active=FALSE WHERE symbol='ETH'");
        assertTrue(statistics.statistics("24h", null).rooms().isEmpty());
        var btc = room("BTC");
        assertEquals(1, btc.viewCount());
        assertEquals(1, btc.participantCount());
        assertEquals(0, btc.hotScore());
        assertEquals(0, btc.activeParticipantCount());
        assertNull(btc.lastActivityAt());
        mvc.perform(get("/api/v1/communities/BTC/stats"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rooms[0].hotScore").value(0));
        mvc.perform(get("/api/v1/communities/ETH/stats")).andExpect(status().isNotFound());
        var cumulative = statistics.statistics("all", "BTC").rooms().getFirst();
        assertEquals(1, cumulative.postCount());
        assertEquals(0, cumulative.hotScore());
        assertEquals(19, statistics.statistics("all", null).rooms().size());
    }

    @Test
    void verificationDoesNotBoostPopularity() {
        long ethMember = member();
        long btcMember = member();
        post("ETH", ethMember, NOW.minusSeconds(1));
        post("BTC", btcMember, NOW.minusSeconds(1));
        jdbc.update("INSERT INTO asset_snapshots(member_id,coin_id,quantity,value_krw,verified,verification_status,captured_at,wallet_count,sync_status) VALUES(?,?,1,1,TRUE,'VERIFIED',?,1,'READY')",
            ethMember, coin("ETH"), Timestamp.from(NOW.minusSeconds(1)));
        jdbc.update("INSERT INTO wallets(member_id,chain_type,address,created_at) VALUES(?,'EVM',?,?)",
            ethMember, "hot-wallet-" + ethMember, Timestamp.from(NOW.minusSeconds(1)));
        assertEquals(100.0, room("ETH").verifiedParticipantRate());
        assertEquals(0.0, room("BTC").verifiedParticipantRate());
        assertEquals(3, room("ETH").hotScore());
        assertEquals(3, room("BTC").hotScore());
    }

    @Test
    void removingTheLatestLikeFallsBackToTheMembersRemainingActivity() {
        long author = member();
        long post = post("ETH", author, NOW.minus(Duration.ofHours(3)));
        like(post, author, NOW.minusSeconds(1));
        assertEquals(3, room("ETH").hotScore());
        jdbc.update("DELETE FROM post_likes WHERE post_id=? AND member_id=?", post, author);
        assertEquals(2, room("ETH").hotScore());
        assertEquals(NOW.minus(Duration.ofHours(3)), room("ETH").lastActivityAt());
        jdbc.update("DELETE FROM posts WHERE id=?", post);
        assertTrue(statistics.statistics("24h", null).rooms().isEmpty());
    }

    @ParameterizedTest
    @MethodSource("ageBoundaries")
    void timeBucketsHaveDeterministicInclusiveLowerAndExclusiveUpperBounds(Duration age, long expected) {
        post("ETH", member(), NOW.minus(age));
        assertEquals(expected, room("ETH").hotScore());
        assertEquals(expected == 0 ? 0 : 1, room("ETH").activeParticipantCount());
        assertEquals(expected == 0 ? 0 : 1, statistics.statistics("24h", null).rooms().size());
    }

    static Stream<Arguments> ageBoundaries() {
        Duration micro = Duration.ofNanos(1000);
        return Stream.of(
            Arguments.of(micro, 3L),
            Arguments.of(Duration.ofHours(1), 3L),
            Arguments.of(Duration.ofHours(1).plus(micro), 2L),
            Arguments.of(Duration.ofHours(6), 2L),
            Arguments.of(Duration.ofHours(6).plus(micro), 1L),
            Arguments.of(Duration.ofHours(24), 1L),
            Arguments.of(Duration.ofHours(24).plus(micro), 0L),
            Arguments.of(Duration.ZERO, 0L),
            Arguments.of(micro.negated(), 0L));
    }

    private CommunityStatisticsService.RoomStatistics room(String symbol) {
        return statistics.statistics("24h", symbol).rooms().getFirst();
    }

    private List<String> symbols() {
        return statistics.statistics("24h", null).rooms().stream()
            .map(CommunityStatisticsService.RoomStatistics::symbol).toList();
    }

    private long member() { return members.saveAndFlush(new Member("hot-" + UUID.randomUUID(), "#123456")).getId(); }
    private long coin(String symbol) { return coins.findBySymbolIgnoreCaseAndActiveTrue(symbol).orElseThrow().getId(); }

    private long post(String symbol, long member, Instant at) {
        jdbc.update("INSERT INTO posts(member_id,coin_id,title,content,author_verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
            member, coin(symbol), "hot-room", "body", false, Timestamp.from(at), Timestamp.from(at));
        return jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=?", Long.class, member);
    }

    private void comment(long post, long member, Instant at) {
        jdbc.update("INSERT INTO comments(post_id,member_id,content,created_at) VALUES(?,?,?,?)",
            post, member, "reply", Timestamp.from(at));
    }

    private void like(long post, long member, Instant at) {
        jdbc.update("INSERT INTO post_likes(post_id,member_id,created_at) VALUES(?,?,?)", post, member, Timestamp.from(at));
    }

    private void view(long post, Long member, Instant at) {
        jdbc.update("INSERT INTO post_view_events(post_id,member_id,created_at) VALUES(?,?,?)", post, member, Timestamp.from(at));
    }
}
