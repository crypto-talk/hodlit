package com.cryptalk.comment;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Positive;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "댓글", description = "게시글 댓글 조회, 작성, 수정 및 삭제 API")
public class CommentController {
    private final CommentService comments;
    public CommentController(CommentService comments) { this.comments = comments; }
    @Operation(summary = "게시글 댓글 목록 조회")
    @GetMapping("/posts/{postId}/comments") List<CommentService.CommentResponse> list(@PathVariable Long postId) { return comments.list(postId); }
    @Operation(summary = "댓글 작성", description = "replyToCommentId로 답글 대상을 지정할 수 있습니다. 대댓글에 답해도 동일한 1단계 깊이에 추가됩니다.")
    @PostMapping("/posts/{postId}/comments") CommentService.CommentResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId, @Valid @RequestBody CreateCommentRequest request) { return comments.create(id(jwt), postId, request.content(), request.replyToCommentId()); }
    @Operation(summary = "댓글 수정", description = "작성자 본인의 댓글 내용을 수정합니다.")
    @PatchMapping("/comments/{commentId}") CommentService.CommentResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long commentId, @Valid @RequestBody UpdateCommentRequest request) { return comments.update(id(jwt), commentId, request.content()); }
    @Operation(summary = "댓글 삭제", description = "작성자 본인의 댓글을 삭제합니다.")
    @DeleteMapping("/comments/{commentId}") ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long commentId) { comments.delete(id(jwt), commentId); return ResponseEntity.noContent().build(); }
    private Long id(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
    public record CreateCommentRequest(@NotBlank @Size(max=1000) String content,
                                       @Positive Long replyToCommentId) {}
    public record UpdateCommentRequest(@NotBlank @Size(max=1000) String content) {}
}
