package com.cryptalk.search;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/search")
@Tag(name="검색", description="공개 글·댓글·방·사용자 검색")
public class SearchController {
    private final SearchService search;
    public SearchController(SearchService search) { this.search = search; }

    @Operation(summary="전체 검색", description="제목/본문/작성자 포함 검색, 관련도순. page 0부터, size 기본 20.")
    @GetMapping
    SearchService.SearchPage search(@RequestParam String q, @RequestParam(defaultValue="0") int page,
                                   @RequestParam(defaultValue="20") int size) {
        return search.search(q, page, size);
    }
}
