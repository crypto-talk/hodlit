package com.cryptalk;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SearchApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired CoinRepository coins;
    @Autowired ObjectMapper json;

    @Test
    void searchesAllFourTypesRanksAndPagesPublicFieldsOnly() throws Exception {
        Member member = new Member("private-never-search@example.test", "test-hash", "needle-author", "#123456");
        long id = members.saveAndFlush(member).getId();
        long coin = coins.findBySymbolIgnoreCaseAndActiveTrue("ETH").orElseThrow().getId();
        jdbc.update("UPDATE coins SET name='needle-room' WHERE id=?", coin);
        Timestamp time = Timestamp.from(Instant.now());
        for (int i=0; i<23; i++) {
            jdbc.update("INSERT INTO posts(member_id,coin_id,title,content,created_at,updated_at) VALUES(?,?,?,?,?,?)",
                id, coin, i==0 ? "needle-title" : "other title", "needle-body", time, time);
        }
        long post = jdbc.queryForObject("SELECT MAX(id) FROM posts WHERE member_id=?", Long.class, id);
        jdbc.update("INSERT INTO comments(post_id,member_id,content,created_at) VALUES(?,?,?,?)", post, id, "needle-comment", time);
        var response = mvc.perform(get("/api/v1/search").param("q", "NEEDLE").param("size", "100"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(26))
            .andExpect(jsonPath("$.items[0].relevance").value(6))
            .andExpect(jsonPath("$.items[0].label").value("needle-title")).andReturn();
        var body = json.readTree(response.getResponse().getContentAsString());
        Set<String> types = new HashSet<>();
        body.path("items").forEach(item -> types.add(item.path("type").asText()));
        assertEquals(Set.of("POST", "COMMENT", "ROOM", "USER"), types);
        assertFalse(response.getResponse().getContentAsString().contains("private-never-search"));
        mvc.perform(get("/api/v1/search").param("q", "needle").param("page", "1"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(6))
            .andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get("/api/v1/search").param("q", "private-never-search"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        jdbc.update("UPDATE coins SET active=FALSE WHERE id=?", coin);
        mvc.perform(get("/api/v1/search").param("q", "needle"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void treatsWildcardsAndSqlFragmentsLiterallyAndValidatesRequests() throws Exception {
        mvc.perform(get("/api/v1/search").param("q", "%"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/search").param("q", "' OR 1=1 --"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/search").param("q", "   ")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/search").param("q", "x".repeat(101))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/search").param("q", "x").param("page", "-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/search").param("q", "x").param("size", "101")).andExpect(status().isBadRequest());
    }
}
