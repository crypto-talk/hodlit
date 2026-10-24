package com.cryptalk.comment;

import com.cryptalk.coin.RoomAccess;
import com.cryptalk.common.ApiException;
import com.cryptalk.asset.AssetService;
import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.member.Member;
import com.cryptalk.post.PostService;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentService {
    private final RoomAccess rooms;
    private final CommentRepository comments; private final PostService posts;
    private final AssetService assets; private final CommentHolderSnapshotRepository holderSnapshots;
    public CommentService(CommentRepository comments, PostService posts, AssetService assets,
                          CommentHolderSnapshotRepository holderSnapshots, RoomAccess rooms) {
        this.rooms = rooms;
        this.comments = comments; this.posts = posts; this.assets = assets; this.holderSnapshots = holderSnapshots;
    }
    @Transactional(readOnly = true)
    public List<CommentResponse> list(Long postId) { posts.post(postId); return comments.findByPostIdOrderByCreatedAt(postId).stream().map(this::response).toList(); }
    @Transactional(readOnly = true)
    public com.cryptalk.common.PageResponse<CommentResponse> numberedPage(Long postId, int page, int size) {
        var request = com.cryptalk.common.PageResponse.request(page, size,
            org.springframework.data.domain.Sort.by("createdAt", "id"));
        posts.post(postId);
        return com.cryptalk.common.PageResponse.of(comments.findByPostId(postId, request).map(this::response));
    }
    @Transactional
    public CommentResponse create(Long memberId, Long postId, String content, Long replyToCommentId) {
        var post = posts.post(postId);
        Comment target = replyToCommentId == null ? null : comment(replyToCommentId);
        if (target != null && !target.getPost().getId().equals(postId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "다른 게시글의 댓글에 답글을 달 수 없습니다.");
        }
        AssetSnapshot asset = assets.snapshotForPublication(memberId, post.getCoin());
        Comment saved = comments.save(new Comment(post, posts.member(memberId), content, target));
        holderSnapshots.save(new CommentHolderSnapshot(saved, asset));
        return response(saved);
    }
    @Transactional
    public CommentResponse update(Long memberId, Long commentId, String content) {
        Comment comment = comment(commentId); posts.own(memberId, comment.getMember().getId()); comment.update(content); return response(comment);
    }
    @Transactional
    public void delete(Long memberId, Long commentId) {
        Comment comment = comment(commentId);
        posts.own(memberId, comment.getMember().getId()); comments.delete(comment);
    }
    private Comment comment(Long id) {
        Comment comment = comments.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));
        rooms.requireOpen(comment.getPost().getCoin());
        return comment;
    }
    private CommentResponse response(Comment comment) {
        Member member = comment.getMember();
        HolderSnapshotResponse snapshot = holderSnapshots.findById(comment.getId()).map(item ->
            new HolderSnapshotResponse(item.getVerificationAvailability(), item.getVerificationLevel(),
                item.isVerifiedHolder(), item.getHoldingMonths(), item.getWalletCount(), item.getCapturedAt(),
                item.getSyncStatus(), item.getHolderStatus())).orElse(null);
        return new CommentResponse(comment.getId(), member.getId(), member.getNickname(), member.getAvatarColor(),
            comment.getContent(), comment.getCreatedAt(), comment.getUpdatedAt(), snapshot,
            comment.getParentCommentId(), comment.getReplyToCommentId(), comment.getReplyToNickname());
    }
    @Schema(description = "작성 당시 확인된 잔액 기준의 불변 보유 기록. 일부 조회 실패 시에도 양수 부분합은 HOLDER로 인증하며 PARTIAL을 유지합니다. 댓글은 수량을 공개하지 않습니다.")
    public record HolderSnapshotResponse(String verificationAvailability, String verificationLevel,
                                         boolean verifiedHolder, Integer holdingMonths, int walletCount,
                                         Instant capturedAt, String syncStatus, String holderStatus) {}
    public record CommentResponse(Long id, Long memberId, String nickname, String avatarColor, String content,
                                  Instant createdAt, Instant updatedAt, HolderSnapshotResponse holderSnapshot,
                                  Long parentCommentId, Long replyToCommentId, String replyToNickname) {}
}
