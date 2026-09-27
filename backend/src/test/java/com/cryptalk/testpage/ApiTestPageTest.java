package com.cryptalk.testpage;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
    "cryptalk.test-pages.enabled=true",
    "cryptalk.test-pages.walletconnect-project-id=0123456789abcdef0123456789abcdef"
})
@AutoConfigureMockMvc
class ApiTestPageTest {
    @Autowired MockMvc mvc;

    @Test
    void servesHubAndTestSubpagesWithoutAuthenticationWhenEnabled() throws Exception {
        for (String path : new String[] {"/test", "/test/auth", "/test/wallet", "/test/api"}) {
            mvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/html"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("CrypTalk API Test Console")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("personal_sign")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("connect-walletconnect")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("/v3/api-docs")));
        }
    }

    @Test
    void servesWalletConnectBundleAndProjectConfiguration() throws Exception {
        mvc.perform(get("/test/walletconnect.bundle.js"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("text/javascript"))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("WalletConnectEthereumProvider")));

        mvc.perform(get("/test/walletconnect.bundle.js.LEGAL.txt"))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("text/plain"));

        mvc.perform(get("/test/config"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.walletConnectProjectId").value("0123456789abcdef0123456789abcdef"));
    }

    @Test
    void omitsTestPageFromPublicApiContract() throws Exception {
        mvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paths['/test']").doesNotExist())
            .andExpect(jsonPath("$.paths['/test/api']").doesNotExist())
            .andExpect(jsonPath("$.paths['/test/config']").doesNotExist());
    }
}
