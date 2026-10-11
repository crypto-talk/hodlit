package com.cryptalk;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import java.sql.Timestamp;
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
class RoomSearchApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired CoinRepository coins;

    @Test
    void restrictsBothTypesToTheRoomAndKeepsRankingAndPagination() throws Exception {
        long author = members.saveAndFlush(new Member("needle-author", "#123456")).getId();
        long eth = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow().getId();
        long btc = coins.findBySymbolIgnoreCaseAndActiveTrue("BTC").orElseThrow().getId();
        Timestamp time = Timestamp.from(Instant.now());
        for (int i=0; i<24; i++) {
            jdbc.update("INSERT INTO posts(member_id,coin_id,title,content,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                author, i==23 ? btc : eth, i==0 ? "needle-title" : i==1 ? "literal_%!" : "other title", "needle-body", time, time);
        }
        long ethPost = jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=? AND coin_id=?", Long.class, author, eth);
        long btcPost = jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=? AND coin_id=?", Long.class, author, btc);
        for (long post : new long[] {ethPost, btcPost}) {
            jdbc.update("INSERT INTO comments(post_id,member_id,content,created_at) VALUES(?,?,?,?)", post, author, "needle-comment", time);
        }
        mvc.perform(get("/api/v1/communities/eth/search").param("q", "NEEDLE"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(24))
            .andExpect(jsonPath("$.items[0].label").value("needle-title"))
            .andExpect(jsonPath("$.items[0].relevance").value(6));
        mvc.perform(get("/api/v1/communities/ETH/search").param("q", "needle").param("page", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(4))
            .andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get("/api/v1/communities/BTC/search").param("q", "needle"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/communities/ETH/search").param("q", "literal_%!"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/communities/ETH/search").param("q", "' OR 1=1 --"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void rejectsInvalidAndInactiveRoomQueries() throws Exception {
        mvc.perform(get("/api/v1/communities/ETH/search").param("q", "  ")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/communities/ETH/search").param("q", "x").param("page", "-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/communities/ETH/search").param("q", "x").param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/communities/MISSING/search").param("q", "x")).andExpect(status().isNotFound());
        jdbc.update("UPDATE coins SET active=FALSE WHERE symbol='ETH'");
        mvc.perform(get("/api/v1/communities/ETH/search").param("q", "x")).andExpect(status().isNotFound());
    }
}
