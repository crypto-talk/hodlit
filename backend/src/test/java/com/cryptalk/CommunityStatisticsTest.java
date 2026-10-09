package com.cryptalk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.CommunityStatisticsService;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CommunityStatisticsTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired CoinRepository coins;
    @Autowired CommunityStatisticsService statistics;

    @Test
    void countsBeyondOneHundredAndSeparatesRecentActivitiesFromOldPosts() throws Exception {
        Member member = members.saveAndFlush(new Member("stats-author", "#123456"));
        long coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow().getId();
        Instant recent = Instant.now().minus(Duration.ofMinutes(5));
        for (int i = 0; i < 105; i++) insertPost(member.getId(), coin, recent);
        long old = insertPost(member.getId(), coin, Instant.now().minus(Duration.ofHours(25)));
        jdbc.update("INSERT INTO comments(post_id,member_id,content,created_at) VALUES(?,?,?,?)",
            old, member.getId(), "new comment on old post", Timestamp.from(recent));
        jdbc.update("INSERT INTO post_likes(post_id,member_id,created_at) VALUES(?,?,?)",
            old, member.getId(), Timestamp.from(recent));
        jdbc.update("INSERT INTO post_view_events(post_id,member_id,created_at) VALUES(?,?,?)",
            old, member.getId(), Timestamp.from(recent));
        jdbc.update("INSERT INTO post_view_events(post_id,member_id,created_at) VALUES(?,NULL,?)",
            old, Timestamp.from(recent));
        var room = statistics.statistics("24h", "eth").rooms().getFirst();
        assertEquals(105, room.postCount());
        assertEquals(1, room.commentCount());
        assertEquals(1, room.likeCount());
        assertEquals(2, room.viewCount());
        assertEquals(1, room.participantCount());
        assertEquals(0, room.verifiedParticipantRate());
        assertEquals(106, statistics.statistics("all", "ETH").rooms().getFirst().postCount());
        mvc.perform(get("/api/v1/communities/eth"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.postCount").value(106));
    }

    @Test
    void publicApiHandlesEmptyRoomsInvalidWindowsAndInactiveSymbols() throws Exception {
        mvc.perform(get("/api/v1/communities/BTC/stats"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rooms[0].participantCount").value(0))
            .andExpect(jsonPath("$.rooms[0].verifiedParticipantRate").value(0));
        mvc.perform(get("/api/v1/communities/stats"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.rooms.length()").value(20));
        mvc.perform(get("/api/v1/communities/stats").param("window", "yesterday"))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/communities/NOT_A_COIN/stats")).andExpect(status().isNotFound());
        jdbc.update("UPDATE coins SET active=FALSE WHERE symbol='BTC'");
        mvc.perform(get("/api/v1/communities/BTC/stats")).andExpect(status().isNotFound());
    }

    @Test
    void anonymousDetailViewsAreCountedAndVerificationRequiresFreshConnectedHoldings() throws Exception {
        Member first = members.saveAndFlush(new Member("stats-fresh", "#123456"));
        Member second = members.saveAndFlush(new Member("stats-stale", "#123456"));
        long coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow().getId();
        Instant recent = Instant.now().minus(Duration.ofMinutes(5));
        long post = insertPost(first.getId(), coin, recent);
        insertPost(second.getId(), coin, recent);
        jdbc.update("INSERT INTO asset_snapshots(member_id,coin_id,quantity,value_krw,verified,verification_status,captured_at,wallet_count,sync_status) VALUES(?,?,1,1,TRUE,'VERIFIED',?,1,'READY')",
            first.getId(), coin, Timestamp.from(recent));
        jdbc.update("INSERT INTO asset_snapshots(member_id,coin_id,quantity,value_krw,verified,verification_status,captured_at,wallet_count,sync_status) VALUES(?,?,1,1,TRUE,'VERIFIED',?,1,'READY')",
            second.getId(), coin, Timestamp.from(recent.minus(Duration.ofHours(2))));
        assertEquals(0, statistics.statistics("24h", "ETH").rooms().getFirst().verifiedParticipantCount());
        for (var id : new long[] {first.getId(), second.getId()}) {
            jdbc.update("INSERT INTO wallets(member_id,chain_type,address,created_at) VALUES(?,'EVM',?,?)",
                id, "stats-wallet-" + id, Timestamp.from(recent));
        }
        mvc.perform(get("/api/v1/posts/{id}", post)).andExpect(status().isOk());
        var room = statistics.statistics("24h", "ETH").rooms().getFirst();
        assertEquals(1, room.viewCount());
        assertEquals(2, room.participantCount());
        assertEquals(1, room.verifiedParticipantCount());
        assertEquals(50, room.verifiedParticipantRate());
    }

    private long insertPost(long member, long coin, Instant when) {
        jdbc.update("INSERT INTO posts(member_id,coin_id,title,content,author_verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
            member, coin, "activity", "content", false, Timestamp.from(when), Timestamp.from(when));
        return jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=?", Long.class, member);
    }
}
