package com.cryptalk.post;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import java.util.List;

public interface PostRepostRepository extends JpaRepository<PostRepost, PostMemberId> {
    long countByPostId(Long postId);
    @Query("select r from PostRepost r where r.post.coin.active = true and r.post.coin.operationStatus = com.cryptalk.coin.RoomOperationStatus.OPEN order by r.createdAt desc, r.post.id desc, r.member.id desc")
    List<PostRepost> findFeed(Pageable pageable);
    @Query("select r from PostRepost r where r.post.coin.active = true and r.post.coin.operationStatus = com.cryptalk.coin.RoomOperationStatus.OPEN and r.createdAt <= :before order by r.createdAt desc, r.post.id desc, r.member.id desc")
    List<PostRepost> findFeedBefore(@Param("before") Instant before, Pageable pageable);
    @Query("select r from PostRepost r where r.post.coin.active = true and r.post.coin.operationStatus = com.cryptalk.coin.RoomOperationStatus.OPEN and r.member.id in :memberIds order by r.createdAt desc, r.post.id desc, r.member.id desc")
    List<PostRepost> findFollowing(@Param("memberIds") List<Long> memberIds, Pageable pageable);
    @Query("select r from PostRepost r where r.post.coin.active = true and r.post.coin.operationStatus = com.cryptalk.coin.RoomOperationStatus.OPEN and r.member.id in :memberIds and r.createdAt <= :before order by r.createdAt desc, r.post.id desc, r.member.id desc")
    List<PostRepost> findFollowingBefore(@Param("memberIds") List<Long> memberIds, @Param("before") Instant before, Pageable pageable);
}
