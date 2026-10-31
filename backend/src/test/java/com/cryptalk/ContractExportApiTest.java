package com.cryptalk;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ContractExportApiTest {
    @Autowired MockMvc mvc;
    @Test
    void exportsImplementedContractForFrontendGeneration() throws Exception {
        byte[] spec = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
            .andExpect(jsonPath("$.paths['/api/v1/admin/banners']").exists())
            .andExpect(jsonPath("$.paths['/api/v1/admin/draw-events']").exists())
            .andExpect(jsonPath("$.paths['/api/v1/search/groups']").exists())
            .andReturn().getResponse().getContentAsByteArray();
        Files.createDirectories(Path.of("build"));
        Files.write(Path.of("build/openapi.json"), spec);
    }
}
