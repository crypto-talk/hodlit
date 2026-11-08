package com.cryptalk.news;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.coin.CoinRepository;
import com.cryptalk.coin.RoomOperationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "cryptalk.news-publisher.token=test-only-publisher-password-at-least-32-bytes")
@AutoConfigureMockMvc
@Transactional
class NewsPublisherApiTest {
    private static final String PATH = "/api/v1/news-publisher/communities/BTC/news";
    private static final String HEADER = "X-News-Publisher-Token";
    private static final String PASSWORD = "test-only-publisher-password-at-least-32-bytes";
    private static final String BODY = """
        {"title":"뉴스 제목","summary":"확인된 짧은 요약","sourceName":"출처","sourceUrl":"https://example.com/article"}
        """;

    @Autowired MockMvc mvc;
    @Autowired CoinRepository coins;
    @Autowired NewsRepository news;

    @BeforeEach
    void openRoom() {
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue("BTC").orElseThrow();
        coin.changeOperationStatus(RoomOperationStatus.OPEN);
        coins.saveAndFlush(coin);
    }

    @Test
    void publishesWithoutJwtAndAppearsInPublicList() throws Exception {
        mvc.perform(post(PATH).header(HEADER, PASSWORD).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.coinSymbol").value("BTC"));
        mvc.perform(get("/api/v1/communities/BTC/news"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].sourceUrl").value("https://example.com/article"));
    }

    @Test
    void bypassesJwtOnlyOnExactPublisherPost() throws Exception {
        mvc.perform(post(PATH).header(HEADER, PASSWORD).header("Authorization", "Bearer invalid")
                .contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/communities/BTC/news").header(HEADER, PASSWORD)
                .contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/news/1").header(HEADER, PASSWORD)
                .contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/news/1").header(HEADER, PASSWORD))
            .andExpect(status().isUnauthorized());
        mvc.perform(put(PATH).header(HEADER, PASSWORD).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsMissingWrongAndEmptyPasswordsWithoutWriting() throws Exception {
        long count = news.count();
        mvc.perform(post(PATH).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").exists());
        for (String password : new String[]{"wrong", ""}) {
            mvc.perform(post(PATH).header(HEADER, password).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        }
        assertThat(news.count()).isEqualTo(count);
    }

    @Test
    void validatesPayloadAndSourceUrl() throws Exception {
        for (String body : new String[]{BODY.replace("뉴스 제목", " "),
                BODY.replace("뉴스 제목", "x".repeat(201)),
                BODY.replace("https://example.com/article", "javascript:alert(1)"),
                BODY.replace("https://example.com/article", "https://user:pass@example.com/article")}) {
            mvc.perform(post(PATH).header(HEADER, PASSWORD).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        }
    }

    @Test
    void rejectsUnknownAndClosedRooms() throws Exception {
        mvc.perform(post(PATH.replace("BTC", "UNKNOWN")).header(HEADER, PASSWORD)
                .contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isNotFound());
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue("BTC").orElseThrow();
        coin.changeOperationStatus(RoomOperationStatus.CLOSE);
        coins.saveAndFlush(coin);
        mvc.perform(post(PATH).header(HEADER, PASSWORD).contentType(MediaType.APPLICATION_JSON).content(BODY))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ROOM_CLOSED"));
    }
}
