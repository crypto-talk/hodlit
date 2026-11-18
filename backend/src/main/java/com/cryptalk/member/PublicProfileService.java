package com.cryptalk.member;

import static com.cryptalk.member.PublicProfileDtos.*;

import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.asset.AssetSnapshotRepository;
import com.cryptalk.asset.HoldingQuantityBand;
import com.cryptalk.comment.CommentHolderSnapshotRepository;
import com.cryptalk.comment.CommentRepository;
import com.cryptalk.common.ApiException;
import com.cryptalk.common.PageResponse;
import com.cryptalk.post.PostHolderSnapshotRepository;
import com.cryptalk.post.PostRepository;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PublicProfileService {
    @org.springframework.beans.factory.annotation.Autowired private AssetPublicationService publication;
    @org.springframework.beans.factory.annotation.Autowired private com.cryptalk.badge.BadgeService badgeSettings;
    private final MemberRepository members;
    private final PostRepository posts;
    private final CommentRepository comments;
    private final AssetSnapshotRepository assets;
    private final PostHolderSnapshotRepository postSnapshots;
    private final com.cryptalk.post.PostCoinAttachments attachments;
    private final CommentHolderSnapshotRepository commentSnapshots;

    public PublicProfileService(MemberRepository members, PostRepository posts, CommentRepository comments,
                                AssetSnapshotRepository assets, PostHolderSnapshotRepository postSnapshots,
                                CommentHolderSnapshotRepository commentSnapshots, com.cryptalk.post.PostCoinAttachments attachments) {
        this.attachments = attachments;
        this.members = members;
        this.posts = posts;
        this.comments = comments;
        this.assets = assets;
        this.postSnapshots = postSnapshots;
        this.commentSnapshots = commentSnapshots;
    }

    public ProfileResponse byNickname(String nickname) {
        return profile(members.findByNickname(nickname).orElseThrow(this::notFound));
    }

    public ProfileResponse byId(Long memberId) {
        return profile(member(memberId));
    }

    private ProfileResponse profile(Member member) {
        List<AssetResponse> publicAssets = visible(member)
            ? assets.findByMemberIdOrderByCoinDisplayOrder(member.getId()).stream()
                .filter(asset -> asset.getCoin().isActive() && !asset.getCoin().isGeneralRoom()
                    && "HOLDER".equals(asset.getHolderStatus()) && publication.visible(member.getId(), asset.getCoin().getId()))
                .map(this::assetResponse).toList()
            : List.of();
        return new ProfileResponse(member.getId(), member.getNickname(), member.getAvatarColor(),
            member.getCreatedAt(), posts.countPublicByMemberId(member.getId()),
            comments.countPublicByMemberId(member.getId()), publicAssets, representativeBadge(member));
    }

    public PageResponse<PostResponse> posts(Long memberId, int page, int size) {
        var request = PageResponse.request(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Member member = member(memberId);
        return PageResponse.of(posts.publicMemberPage(memberId, request).map(post -> {
            var roomSnapshot = post.getCoin().isGeneralRoom() ? null : postSnapshots.findById(post.getId()).orElse(null);
            PostSnapshotResponse snapshot = roomSnapshot != null && visible(member)
                    && publication.visible(memberId, post.getCoin().getId())
                ? new PostSnapshotResponse(roomSnapshot.getVerificationAvailability(), roomSnapshot.getVerificationLevel(),
                    roomSnapshot.isVerifiedHolder(), roomSnapshot.getQuantityBand(), roomSnapshot.getHoldingMonths(),
                    roomSnapshot.getCapturedAt(), roomSnapshot.getSyncStatus(), roomSnapshot.getHolderStatus(), roomSnapshot.getBadge())
                : null;
            return new PostResponse(post.getId(), post.getCoin().getSymbol(), post.getTitle(), post.getContent(),
                post.getCreatedAt(), post.getUpdatedAt(), snapshot, attachments.visibleSnapshots(post, roomSnapshot));
        }));
    }

    public PageResponse<CommentResponse> comments(Long memberId, int page, int size) {
        var request = PageResponse.request(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        Member member = member(memberId);
        return PageResponse.of(comments.publicMemberPage(memberId, request).map(comment -> {
            var coin = comment.getPost().getCoin();
            CommentSnapshotResponse snapshot = visible(member) && !coin.isGeneralRoom()
                && publication.visible(memberId, coin.getId()) ? commentSnapshots.findById(comment.getId()).map(item ->
                new CommentSnapshotResponse(item.getVerificationAvailability(), item.getVerificationLevel(),
                    item.isVerifiedHolder(), item.getHoldingMonths(), item.getCapturedAt(),
                    item.getSyncStatus(), item.getHolderStatus(), item.getBadge())).orElse(null) : null;
            return new CommentResponse(comment.getId(), comment.getPost().getId(), comment.getPost().getTitle(),
                comment.getPost().getCoin().getSymbol(), comment.getContent(), comment.getCreatedAt(),
                comment.getUpdatedAt(), comment.getParentCommentId(), comment.getReplyToCommentId(),
                comment.getReplyToNickname(), snapshot);
        }));
    }

    private AssetResponse assetResponse(AssetSnapshot asset) {
        Integer months = asset.getHoldingSince() == null ? null : Math.toIntExact(Math.max(0,
            ChronoUnit.MONTHS.between(asset.getHoldingSince().atZone(ZoneOffset.UTC).toLocalDate(),
                asset.getCapturedAt().atZone(ZoneOffset.UTC).toLocalDate())));
        return new AssetResponse(asset.getCoin().getSymbol(), asset.getCoin().getName(),
            publicBand(asset), months,
            asset.getVerificationLevel(), asset.getSyncStatus(), asset.getCapturedAt());
    }

    private com.cryptalk.badge.BadgeSnapshot representativeBadge(Member member) {
        if (!visible(member)) return null;
        var recent = posts.publicMemberPage(member.getId(), org.springframework.data.domain.PageRequest.of(0, 1,
            Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        if (recent.isEmpty()) return null;
        var post = recent.getContent().getFirst();
        if (post.getCoin().isGeneralRoom() || !publication.visible(member.getId(), post.getCoin().getId())) return null;
        return postSnapshots.findById(post.getId()).map(com.cryptalk.post.PostHolderSnapshot::getBadge).orElse(null);
    }
    private String publicBand(AssetSnapshot asset) {
        var badge = badgeSettings.capture(asset.getCoin(), asset);
        return badge == null ? HoldingQuantityBand.of(asset.getCoin().getSymbol(), asset.getQuantity()) : badge.getQuantityBand();
    }
    private boolean visible(Member member) { return member.getAssetVisibility() != AssetVisibility.HIDDEN; }
    private Member member(Long id) { return members.findById(id).orElseThrow(this::notFound); }
    private ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."); }
}
