package com.cryptalk.news;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "cryptalk.news-publisher.token=")
@AutoConfigureMockMvc
class NewsPublisherDisabledApiTest {
    @Autowired MockMvc mvc;

    @Test
    void emptyServerConfigurationNeverGrantsAccess() throws Exception {
        mvc.perform(post("/api/v1/news-publisher/communities/BTC/news")
                .header("X-News-Publisher-Token", "any-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title":"제목","summary":"요약","sourceName":"출처","sourceUrl":"https://example.com/article"}
                    """))
            .andExpect(status().isUnauthorized());
    }
}
