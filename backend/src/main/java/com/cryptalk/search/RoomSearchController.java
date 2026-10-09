package com.cryptalk.search;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/communities/{symbol}/search")
@Tag(name="검색", description="공개 글·댓글·방·사용자 검색")
public class RoomSearchController {
    private final RoomSearchService search;
    public RoomSearchController(RoomSearchService search) { this.search = search; }

    @Operation(summary="방 내 글·댓글 검색", description="현재 활성 방에만 한정한 제목/본문/작성자 포함 검색, 관련도순. page 0부터, size 기본 20.")
    @GetMapping
    RoomSearchService.SearchPage search(@PathVariable String symbol, @RequestParam String q,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return search.search(symbol, q, page, size);
    }
}
