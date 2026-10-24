package com.cryptalk.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    private static final String BEARER_AUTH = "bearerAuth";

    @Bean
    OpenAPI cryptalkOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("CrypTalk API")
                .description("코인 커뮤니티 CrypTalk 백엔드 REST API")
                .version("v1"))
            .components(new Components()
                .addSecuritySchemes(BEARER_AUTH, new SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")))
            .addSecurityItem(new SecurityRequirement().addList(BEARER_AUTH));
    }
}
