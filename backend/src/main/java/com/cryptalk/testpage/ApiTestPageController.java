package com.cryptalk.testpage;

import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@Hidden
@RestController
@ConditionalOnProperty(prefix = "cryptalk.test-pages", name = "enabled", havingValue = "true")
public class ApiTestPageController {
    private final String walletConnectProjectId;

    ApiTestPageController(@Value("${cryptalk.test-pages.walletconnect-project-id:}") String walletConnectProjectId) {
        this.walletConnectProjectId = walletConnectProjectId;
    }

    @GetMapping(value = {"/test", "/test/", "/test/auth", "/test/wallet", "/test/social", "/test/exchanges", "/test/api"},
                produces = MediaType.TEXT_HTML_VALUE)
    ResponseEntity<Resource> apiTestPage() {
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .cacheControl(CacheControl.noStore())
            .body(new ClassPathResource("test-pages/api.html"));
    }

    @GetMapping(value = "/test/walletconnect.bundle.js", produces = "text/javascript")
    ResponseEntity<Resource> walletConnectBundle() {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("text/javascript"))
            .cacheControl(CacheControl.noStore())
            .body(new ClassPathResource("test-pages/walletconnect.bundle.js"));
    }

    @GetMapping(value = "/test/walletconnect.bundle.js.LEGAL.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    ResponseEntity<Resource> walletConnectLicenses() {
        return ResponseEntity.ok()
            .contentType(MediaType.TEXT_PLAIN)
            .body(new ClassPathResource("test-pages/walletconnect.bundle.js.LEGAL.txt"));
    }

    @GetMapping("/test/config")
    TestPageConfig config() {
        return new TestPageConfig(walletConnectProjectId);
    }

    record TestPageConfig(String walletConnectProjectId) {}
}
