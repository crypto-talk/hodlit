package com.cryptalk;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class BannerApiTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    private static final String FILE = "00000000-0000-0000-0000-000000000001.png";
    private static final String PATH = "/api/v1/admin/banners";

    @BeforeEach
    void setup() {
        jdbc.update("INSERT INTO members(id,role,nickname,avatar_color,asset_visibility,created_at,updated_at) VALUES(100000,'ADMIN','banner-admin','#123456','EXACT',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        jdbc.update("INSERT INTO media_assets(file_name,member_id,media_type,content_type,size_bytes,created_at) VALUES(?,100000,'IMAGE','image/png',100,CURRENT_TIMESTAMP)", FILE);
    }

    @Test
    void managesVisibilityOrderingAndProtectsImages() throws Exception {
        long first = create(true, 5);
        long second = create(false, 0);
        mvc.perform(get("/api/v1/banners")).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(first))
            .andExpect(jsonPath("$[0].title").doesNotExist());
        mvc.perform(get(PATH + "/{id}", first).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Banner"));
        mvc.perform(patch(PATH + "/{id}", second).with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(body(true, 0, "/subhodl/ETH")))
            .andExpect(status().isOk());
        mvc.perform(patch(PATH + "/order").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("ids", new long[] {first, second}))))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(first));
        mvc.perform(patch(PATH + "/order").with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("ids", new long[] {first, first}))))
            .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/v1/media/" + FILE).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isConflict());
        mvc.perform(delete(PATH + "/{id}", first).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNoContent());
        mvc.perform(get(PATH + "/{id}", first).with(jwt().jwt(t -> t.subject("100000"))))
            .andExpect(status().isNotFound());
    }

    @Test
    void enforcesAdminAndRejectsInvalidLinksAndImages() throws Exception {
        mvc.perform(get(PATH)).andExpect(status().isUnauthorized());
        mvc.perform(get(PATH).with(jwt().jwt(t -> t.subject("999999")))).andExpect(status().isForbidden());
        for (String link : new String[] {"javascript:alert(1)", "//evil.example", "/\\evil.example", "data:text/html,x"}) {
            mvc.perform(post(PATH).with(jwt().jwt(t -> t.subject("100000"))).contentType(MediaType.APPLICATION_JSON)
                .content(body(true, 0, link))).andExpect(status().isBadRequest());
        }
        mvc.perform(post(PATH).with(jwt().jwt(t -> t.subject("100000"))).contentType(MediaType.APPLICATION_JSON)
            .content(body(true, 0, "/").replace(FILE, "missing.png"))).andExpect(status().isBadRequest());
    }

    private long create(boolean visible, int order) throws Exception {
        String response = mvc.perform(post(PATH).with(jwt().jwt(t -> t.subject("100000")))
            .contentType(MediaType.APPLICATION_JSON).content(body(visible, order, "/subhodl/ETH")))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("id").asLong();
    }
    private String body(boolean visible, int order, String link) throws Exception {
        return json.writeValueAsString(Map.of("title", "Banner", "imageUrl", "/api/v1/media/" + FILE,
            "altText", "ETH event", "linkUrl", link, "visible", visible, "displayOrder", order));
    }
}
