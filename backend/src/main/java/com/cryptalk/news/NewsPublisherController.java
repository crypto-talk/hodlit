package com.cryptalk.news;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/news-publisher")
@Tag(name = "뉴스 게시 연동", description = "뉴스 등록 전용 비밀번호 인증")
public class NewsPublisherController {
    private final NewsService news;

    public NewsPublisherController(NewsService news) { this.news = news; }

    @Operation(summary = "스킬용 방 뉴스 등록", description = "JWT 대신 X-News-Publisher-Token 헤더로 인증합니다. 비밀번호 미설정 시 비활성화됩니다.")
    @SecurityRequirement(name = "newsPublisherToken")
    @PostMapping("/communities/{symbol}/news")
    ResponseEntity<NewsDtos.NewsResponse> create(
            @Parameter(hidden = true) @RequestHeader(value = "X-News-Publisher-Token", required = false) String password,
            @PathVariable String symbol, @Valid @RequestBody NewsDtos.SaveNewsRequest request) {
        return ResponseEntity.status(201).body(news.createFromPublisher(password, symbol, request));
    }
}
