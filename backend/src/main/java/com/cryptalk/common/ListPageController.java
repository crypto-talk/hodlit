package com.cryptalk.common;

import com.cryptalk.comment.CommentService;
import com.cryptalk.post.PostDtos.PostResponse;
import com.cryptalk.post.PostService;
import com.cryptalk.wallet.WalletService;
import com.cryptalk.exchange.ExchangeConnectionService;
import com.cryptalk.social.FollowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "게시글·피드", description = "페이지 번호 기반 공개 목록")
public class ListPageController {
    private final PostService posts;
    private final CommentService comments;

    private final WalletService wallets;
    private final ExchangeConnectionService exchanges;
    private final FollowService follows;

    public ListPageController(PostService posts, CommentService comments, WalletService wallets,
                              ExchangeConnectionService exchanges, FollowService follows) {
        this.posts = posts;
        this.comments = comments;
        this.wallets = wallets;
        this.exchanges = exchanges;
        this.follows = follows;
    }

    @Operation(summary = "전체 글 페이지 조회", description = "page는 0부터, size 기본 20. 재게시 이벤트가 아닌 고유 게시글 목록입니다.")
    @GetMapping("/posts/page")
    PageResponse<PostResponse> posts(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size,
            @RequestParam(defaultValue="false") boolean verified) {
        return posts.numberedPage(null, viewer(jwt), verified, page, size);
    }

    @Operation(summary = "방 글 페이지 조회", description = "verified=true이면 인증 글만 서버에서 필터링하며 해당 필터 기준 전체 개수를 반환합니다.")
    @GetMapping("/communities/{symbol}/posts/page")
    PageResponse<PostResponse> room(@PathVariable String symbol, @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size,
            @RequestParam(defaultValue="false") boolean verified) {
        return posts.numberedPage(symbol, viewer(jwt), verified, page, size);
    }

    @Operation(summary = "댓글 페이지 조회", description = "댓글은 작성 시각·ID 오름차순이며 기본 20개씩 반환합니다.")
    @GetMapping("/posts/{postId}/comments/page")
    PageResponse<CommentService.CommentResponse> comments(@PathVariable Long postId,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return comments.numberedPage(postId, page, size);
    }

    @Operation(summary = "내 북마크 페이지 조회")
    @GetMapping("/me/bookmarks/page")
    PageResponse<PostResponse> bookmarks(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return posts.bookmarkPage(viewer(jwt), page, size);
    }

    @Operation(summary = "내 지갑 페이지 조회")
    @GetMapping("/me/wallets/page")
    PageResponse<WalletService.WalletResponse> wallets(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return wallets.numberedPage(viewer(jwt), page, size);
    }

    @Operation(summary = "내 거래소 연결 페이지 조회")
    @GetMapping("/me/exchanges/page")
    PageResponse<ExchangeConnectionService.ConnectionResponse> exchanges(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return exchanges.numberedPage(viewer(jwt), page, size);
    }

    @Operation(summary = "팔로워 페이지 조회")
    @GetMapping("/members/{memberId}/followers/page")
    PageResponse<FollowService.MemberSummary> followers(@PathVariable Long memberId,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return follows.numberedPage(memberId, false, page, size);
    }

    @Operation(summary = "팔로잉 회원 페이지 조회")
    @GetMapping("/members/{memberId}/following/page")
    PageResponse<FollowService.MemberSummary> following(@PathVariable Long memberId,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return follows.numberedPage(memberId, true, page, size);
    }

    private Long viewer(Jwt jwt) {
        return jwt == null ? null : Long.valueOf(jwt.getSubject());
    }
}
