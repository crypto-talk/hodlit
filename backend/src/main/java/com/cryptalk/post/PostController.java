package com.cryptalk.post;

import com.cryptalk.post.PostDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "게시글·피드", description = "커뮤니티 게시글, 피드, 좋아요, 북마크 및 재게시 API")
public class PostController {
    private final PostService posts;
    public PostController(PostService posts) { this.posts = posts; }
    @Operation(summary = "커뮤니티 게시글 목록 조회", description = "코인 커뮤니티의 게시글을 최신순으로 조회합니다.")
    @GetMapping("/communities/{symbol}/posts")
    List<PostResponse> list(@PathVariable String symbol, @RequestParam(defaultValue="30") int size, @AuthenticationPrincipal Jwt jwt) {
        return posts.list(symbol, jwt == null ? null : id(jwt), size);
    }
    @Operation(summary = "전체 피드 조회", description = "커서 기반으로 전체 활동 피드를 조회합니다.")
    @GetMapping("/feed")
    FeedPageResponse feed(@RequestParam(required=false) String cursor, @RequestParam(defaultValue="30") int size,
                          @AuthenticationPrincipal Jwt jwt) {
        return posts.feed(jwt == null ? null : id(jwt), cursor, size);
    }
    @Operation(summary = "팔로잉 피드 조회", description = "로그인 회원이 팔로우한 회원의 게시글을 커서 기반으로 조회합니다.")
    @GetMapping("/feed/following")
    FeedPageResponse followingFeed(@RequestParam(required=false) String cursor,
                                   @RequestParam(defaultValue="30") int size,
                                   @AuthenticationPrincipal Jwt jwt) {
        return posts.followingFeed(id(jwt), cursor, size);
    }
    @Operation(summary = "게시글 상세 조회")
    @GetMapping("/posts/{postId}")
    PostResponse get(@PathVariable Long postId, @AuthenticationPrincipal Jwt jwt) {
        return posts.get(postId, jwt == null ? null : id(jwt));
    }
    @Operation(summary = "게시글 작성", description = "로그인 회원이 커뮤니티에 게시글을 작성하고 현재 가격 스냅샷을 저장합니다. 보유 인증은 DB에 저장된 자산 정보를 사용하며 잔액 조회·인증 여부는 작성 권한과 무관합니다.")
    @PostMapping("/posts") PostResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreatePostRequest request) { return posts.create(id(jwt), request); }
    @Operation(summary = "게시글 수정", description = "작성자 본인의 게시글을 수정합니다.")
    @PutMapping("/posts/{postId}") PostResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId, @Valid @RequestBody UpdatePostRequest request) { return posts.update(id(jwt), postId, request); }
    @Operation(summary = "게시글 삭제", description = "작성자 본인의 게시글과 연결된 미디어를 삭제합니다.")
    @DeleteMapping("/posts/{postId}") ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) { posts.delete(id(jwt), postId); return ResponseEntity.noContent().build(); }
    @Operation(summary = "게시글 좋아요")
    @PostMapping("/posts/{postId}/likes") PostResponse like(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) { return posts.like(id(jwt), postId); }
    @Operation(summary = "게시글 좋아요 취소")
    @DeleteMapping("/posts/{postId}/likes") PostResponse unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) { return posts.unlike(id(jwt), postId); }
    @Operation(summary = "게시글 북마크")
    @PostMapping("/posts/{postId}/bookmarks") PostResponse bookmark(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) { return posts.bookmark(id(jwt), postId); }
    @Operation(summary = "게시글 북마크 취소")
    @DeleteMapping("/posts/{postId}/bookmarks") PostResponse unbookmark(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) { return posts.unbookmark(id(jwt), postId); }
    @Operation(summary = "내 북마크 목록 조회")
    @GetMapping("/me/bookmarks") List<PostResponse> bookmarks(@AuthenticationPrincipal Jwt jwt) { return posts.bookmarks(id(jwt)); }
    @Operation(summary = "게시글 재게시")
    @PostMapping("/posts/{postId}/reposts") PostResponse repost(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) { return posts.repost(id(jwt), postId); }
    @Operation(summary = "게시글 재게시 취소")
    @DeleteMapping("/posts/{postId}/reposts") PostResponse unrepost(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) { return posts.unrepost(id(jwt), postId); }
    private Long id(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
}
