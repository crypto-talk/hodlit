package com.cryptalk.social;

import com.cryptalk.common.ApiException;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FollowService {
    private final FollowRepository follows;
    private final MemberRepository members;

    public FollowService(FollowRepository follows, MemberRepository members) { this.follows = follows; this.members = members; }

    @Transactional
    public FollowStats follow(Long actorId, Long targetId) {
        if (actorId.equals(targetId)) throw new ApiException(HttpStatus.BAD_REQUEST, "자기 자신은 팔로우할 수 없습니다.");
        FollowId id = new FollowId(actorId, targetId);
        if (!follows.existsById(id)) follows.save(new Follow(member(actorId), member(targetId)));
        return stats(actorId, targetId);
    }

    @Transactional
    public FollowStats unfollow(Long actorId, Long targetId) {
        follows.deleteById(new FollowId(actorId, targetId));
        return stats(actorId, targetId);
    }

    @Transactional(readOnly = true)
    public FollowStats stats(Long viewerId, Long memberId) {
        member(memberId);
        return new FollowStats(memberId, follows.countByFollowingId(memberId), follows.countByFollowerId(memberId),
            viewerId != null && follows.existsById(new FollowId(viewerId, memberId)));
    }

    @Transactional(readOnly = true)
    public List<MemberSummary> followers(Long memberId) {
        member(memberId);
        return follows.findByFollowingIdOrderByCreatedAtDesc(memberId).stream().map(follow -> summary(follow.getFollower())).toList();
    }

    @Transactional(readOnly = true)
    public List<MemberSummary> following(Long memberId) {
        member(memberId);
        return follows.findByFollowerIdOrderByCreatedAtDesc(memberId).stream().map(follow -> summary(follow.getFollowing())).toList();
    }

    @Transactional(readOnly = true)
    public com.cryptalk.common.PageResponse<MemberSummary> numberedPage(Long memberId, boolean following, int page, int size) {
        member(memberId);
        var request = com.cryptalk.common.PageResponse.request(page, size,
            org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,
                "createdAt", following ? "following.id" : "follower.id"));
        var result = following ? follows.findByFollowerId(memberId, request) : follows.findByFollowingId(memberId, request);
        return com.cryptalk.common.PageResponse.of(result.map(item -> summary(following ? item.getFollowing() : item.getFollower())));
    }

    private Member member(Long id) { return members.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다.")); }
    private MemberSummary summary(Member member) { return new MemberSummary(member.getId(), member.getNickname(), member.getAvatarColor()); }

    public record FollowStats(Long memberId, long followers, long following, boolean followedByMe) {}
    public record MemberSummary(Long id, String nickname, String avatarColor) {}
}
