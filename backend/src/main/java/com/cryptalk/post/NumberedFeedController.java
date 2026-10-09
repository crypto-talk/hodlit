package com.cryptalk.post;

import com.cryptalk.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/feed")
@Tag(name="게시글·피드",description="페이지 번호 기반 활동 피드")
public class NumberedFeedController {
    private final NumberedFeedService feeds;
    public NumberedFeedController(NumberedFeedService feeds) { this.feeds = feeds; }

    @Operation(summary="전체 활동 피드 페이지 조회",description="글과 재게시를 함께 번호 페이지로 조회합니다. 기존 cursor 계약은 유지됩니다.")
    @GetMapping("/page")
    PageResponse<PostDtos.FeedItemResponse> global(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return feeds.page(jwt == null ? null : Long.valueOf(jwt.getSubject()),false,page,size);
    }

    @Operation(summary="팔로잉 활동 피드 페이지 조회",description="인증 회원이 팔로우한 작성자/재게시자의 활동만 조회합니다.")
    @GetMapping("/following/page")
    PageResponse<PostDtos.FeedItemResponse> following(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return feeds.page(Long.valueOf(jwt.getSubject()),true,page,size);
    }
}
