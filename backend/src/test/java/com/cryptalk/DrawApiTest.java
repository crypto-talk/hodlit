package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.cryptalk.draw.DrawService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class DrawApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired DrawService service;

    @Test
    void configuresEventAndReturnsOneImmutableResultAcrossConcurrentRequests() throws Exception {
        long admin = member("draw-admin", "ADMIN");
        long user = member("draw-user", "USER");
        long event = 0;
        try {
            mvc.perform(get("/api/v1/admin/draw-events")).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/v1/admin/draw-events").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
                .andExpect(status().isForbidden());
            String body = json.writeValueAsString(Map.of("title", "Draw", "description", "Free event",
                "startsAt", Instant.now().plusSeconds(120).toString(), "endsAt", Instant.now().plusSeconds(3600).toString()));
            String created = mvc.perform(post("/api/v1/admin/draw-events").with(jwt().jwt(t -> t.subject(Long.toString(admin))))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
            event = json.readTree(created).get("id").asLong();
            String path = "/api/v1/admin/draw-events/" + event;
            mvc.perform(get("/api/v1/draw-events/" + event)).andExpect(status().isNotFound());
            mvc.perform(patch(path + "/status").with(jwt().jwt(t -> t.subject(Long.toString(admin))))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}")).andExpect(status().isBadRequest());
            String prizes = json.writeValueAsString(Map.of("prizes", List.of(Map.of("name", "Gift", "description", "Record only",
                "imageUrl", "https://example.com/gift.png", "weight", 1, "displayOrder", 0))));
            mvc.perform(put(path + "/prizes").with(jwt().jwt(t -> t.subject(Long.toString(admin))))
                .contentType(MediaType.APPLICATION_JSON).content(prizes)).andExpect(status().isOk());
            service.status(admin, event, "ACTIVE");
            mvc.perform(get("/api/v1/draw-events/" + event)).andExpect(status().isOk())
                .andExpect(jsonPath("$.prizes[0].weight").doesNotExist()).andExpect(jsonPath("$.canParticipate").value(false));
            mvc.perform(get("/api/v1/draw-events/" + event + "/me")).andExpect(status().isUnauthorized());
            mvc.perform(post("/api/v1/draw-events/" + event + "/draw").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
                .andExpect(status().isConflict());
            jdbc.update("UPDATE draw_events SET starts_at=? WHERE id=?", java.sql.Timestamp.from(Instant.now().minusSeconds(5)), event);
            final long eventId = event;
            try (var pool = Executors.newFixedThreadPool(4)) {
                var gate = new CountDownLatch(1);
                var futures = new java.util.ArrayList<Future<DrawService.Result>>();
                for (int i = 0; i < 4; i++) futures.add(pool.submit(() -> { gate.await(); return service.draw(user, eventId); }));
                gate.countDown();
                Long result = futures.getFirst().get(15, TimeUnit.SECONDS).id();
                for (var future : futures) assertThat(future.get(15, TimeUnit.SECONDS).id()).isEqualTo(result);
            }
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM draw_results WHERE event_id=? AND member_id=?", Long.class, event, user)).isEqualTo(1);
            mvc.perform(put(path + "/prizes").with(jwt().jwt(t -> t.subject(Long.toString(admin))))
                .contentType(MediaType.APPLICATION_JSON).content(prizes)).andExpect(status().isConflict());
            service.status(admin, event, "PAUSED");
            mvc.perform(post("/api/v1/draw-events/" + event + "/draw").with(jwt().jwt(t -> t.subject(Long.toString(user)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.existing").value(true)).andExpect(jsonPath("$.prizeName").value("Gift"));
        } finally {
            jdbc.update("DELETE FROM draw_results WHERE event_id=?", event);
            jdbc.update("DELETE FROM draw_prizes WHERE event_id=?", event);
            jdbc.update("DELETE FROM draw_events WHERE id=?", event);
            jdbc.update("DELETE FROM members WHERE id IN (?,?)", admin, user);
        }
    }

    private long member(String nickname, String role) {
        jdbc.update("INSERT INTO members(role,nickname,avatar_color,asset_visibility,created_at,updated_at) VALUES(?,?, '#123456','EXACT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", role, nickname);
        return jdbc.queryForObject("SELECT id FROM members WHERE nickname=?", Long.class, nickname);
    }
}
