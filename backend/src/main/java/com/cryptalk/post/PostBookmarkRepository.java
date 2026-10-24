package com.cryptalk.post;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostBookmarkRepository extends JpaRepository<PostBookmark, PostMemberId> {
    @org.springframework.data.jpa.repository.Query("select b from PostBookmark b where b.member.id = :memberId and b.post.coin.active = true and b.post.coin.operationStatus = com.cryptalk.coin.RoomOperationStatus.OPEN order by b.createdAt desc, b.post.id desc")
    List<PostBookmark> findByMemberIdOrderByCreatedAtDesc(Long memberId);
    @org.springframework.data.jpa.repository.Query("select b from PostBookmark b where b.member.id = :memberId and b.post.coin.active = true and b.post.coin.operationStatus = com.cryptalk.coin.RoomOperationStatus.OPEN order by b.createdAt desc, b.post.id desc")
    org.springframework.data.domain.Page<PostBookmark> findByMemberId(Long memberId, org.springframework.data.domain.Pageable pageable);
}
