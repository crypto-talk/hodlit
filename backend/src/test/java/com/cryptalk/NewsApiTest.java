package com.cryptalk;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties="cryptalk.admin.member-ids=100000")
@AutoConfigureMockMvc
@Transactional
class NewsApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired MemberRepository members;
    @Autowired ObjectMapper json;
    long user;
    final String body = "{\"title\":\"Ethereum update\",\"summary\":\"Own short summary\",\"sourceName\":\"Example\",\"sourceUrl\":\"https://example.com/news\"}";

    @BeforeEach
    void setup() {
        jdbc.update("INSERT INTO members(id,nickname,avatar_color,asset_visibility,created_at,updated_at) VALUES(100000,'news-admin','#123456','EXACT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        user = members.saveAndFlush(new Member("ordinary-news-user", "#123456")).getId();
    }

    @Test
    void adminCrudIsPubliclyReadableOnlyInTheCorrectRoom() throws Exception {
        long id = json.readTree(mvc.perform(post("/api/v1/communities/eth/news")
            .with(jwt().jwt(token -> token.subject("100000"))).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(get("/api/v1/communities/ETH/news"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].title").value("Ethereum update"))
            .andExpect(jsonPath("$.items[0].sourceName").value("Example"));
        mvc.perform(get("/api/v1/communities/BTC/news"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(put("/api/v1/news/{id}",id).with(jwt().jwt(token -> token.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(body.replace("Ethereum update","New headline")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("New headline"));
        mvc.perform(delete("/api/v1/news/{id}",id).with(jwt().jwt(token -> token.subject("100000"))))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/communities/ETH/news"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void deniesOrdinaryAndMissingAuthenticationAndUnsafeUrls() throws Exception {
        mvc.perform(post("/api/v1/communities/ETH/news").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
        for (var request : java.util.List.of(post("/api/v1/communities/ETH/news"),put("/api/v1/news/999999"),delete("/api/v1/news/999999"))) {
            mvc.perform(request.with(jwt().jwt(token -> token.subject(Long.toString(user))))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        }
        for (String url : new String[] {"javascript:alert(1)","https://user:pass@example.com/news","/relative"}) {
            mvc.perform(post("/api/v1/communities/ETH/news").with(jwt().jwt(token -> token.subject("100000")))
                .contentType(MediaType.APPLICATION_JSON).content(body.replace("https://example.com/news",url)))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/communities/MISSING/news").with(jwt().jwt(token -> token.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/communities/ETH/news").param("page","-1")).andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/news/999999").with(jwt().jwt(token -> token.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNotFound());
    }
}
