package com.cryptalk;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PaginationErrorDispatchTest {
    @Autowired TestRestTemplate http;

    // A real servlet container also exercises ERROR dispatches, which MockMvc does not follow.
    @ParameterizedTest
    @ValueSource(strings = {
        "/api/v1/posts/page?page=abc",
        "/api/v1/posts/page?size=abc",
        "/api/v1/coins/page?page=abc",
        "/api/v1/posts/8/comments/page?page=abc"
    })
    void returnsBadRequestInsteadOfAuthenticationError(String path) {
        var response = http.getForEntity(path, JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        String parameter = path.contains("?size=") ? "size" : "page";
        assertThat(response.getBody().path("message").asText())
            .isEqualTo(parameter + ": 정수로 입력해 주세요.");
        assertThat(response.getBody().path("timestamp").asText()).isNotBlank();
    }
}
