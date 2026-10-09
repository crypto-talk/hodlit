package com.cryptalk.news;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Tag(name="방 뉴스", description="관리자가 등록하는 코인별 제목·요약·원문 링크")
public class NewsController {
    private final NewsService news;
    public NewsController(NewsService news) { this.news = news; }

    @Operation(summary="방 뉴스 페이지 조회")
    @GetMapping("/communities/{symbol}/news")
    NewsDtos.NewsPage list(@PathVariable String symbol, @RequestParam(defaultValue="0") int page,
                          @RequestParam(defaultValue="20") int size) {
        return news.list(symbol, page, size);
    }

    @Operation(summary="관리자 방 뉴스 등록")
    @PostMapping("/communities/{symbol}/news")
    ResponseEntity<NewsDtos.NewsResponse> create(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol,
                                                @Valid @RequestBody NewsDtos.SaveNewsRequest request) {
        return ResponseEntity.status(201).body(news.create(Long.valueOf(jwt.getSubject()),symbol,request));
    }

    @Operation(summary="관리자 뉴스 수정")
    @PutMapping("/news/{newsId}")
    NewsDtos.NewsResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long newsId,
                                @Valid @RequestBody NewsDtos.SaveNewsRequest request) {
        return news.update(Long.valueOf(jwt.getSubject()),newsId,request);
    }

    @Operation(summary="관리자 뉴스 삭제")
    @DeleteMapping("/news/{newsId}")
    ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long newsId) {
        news.delete(Long.valueOf(jwt.getSubject()),newsId);
        return ResponseEntity.noContent().build();
    }
}
