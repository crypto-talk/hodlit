package com.cryptalk.comment;

import com.cryptalk.common.ApiException;
import com.cryptalk.asset.AssetService;
import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.member.Member;
import com.cryptalk.post.PostService;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommentService {
    private final CommentRepository comments; private final PostService posts;
    private final AssetService assets; private final CommentHolderSnapshotRepository holderSnapshots;
    public CommentService(CommentRepository comments, PostService posts, AssetService assets,
                          CommentHolderSnapshotRepository holderSnapshots) {
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
    public CommentResponse create(Long memberId, Long postId, String content) {
        var post = posts.post(postId);
        AssetSnapshot asset = assets.snapshotForPublication(memberId, post.getCoin());
        Comment saved = comments.save(new Comment(post, posts.member(memberId), content));
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
    private Comment comment(Long id) { return comments.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다.")); }
    private CommentResponse response(Comment comment) {
        Member member = comment.getMember();
        HolderSnapshotResponse snapshot = holderSnapshots.findById(comment.getId()).map(item ->
            new HolderSnapshotResponse(item.getVerificationAvailability(), item.getVerificationLevel(),
                item.isVerifiedHolder(), item.getHoldingMonths(), item.getWalletCount(), item.getCapturedAt(),
                item.getSyncStatus())).orElse(null);
        return new CommentResponse(comment.getId(), member.getId(), member.getNickname(), member.getAvatarColor(),
            comment.getContent(), comment.getCreatedAt(), comment.getUpdatedAt(), snapshot);
    }
    public record HolderSnapshotResponse(String verificationAvailability, String verificationLevel,
                                         boolean verifiedHolder, Integer holdingMonths, int walletCount,
                                         Instant capturedAt, String syncStatus) {}
    public record CommentResponse(Long id, Long memberId, String nickname, String avatarColor, String content,
                                  Instant createdAt, Instant updatedAt, HolderSnapshotResponse holderSnapshot) {}
}
