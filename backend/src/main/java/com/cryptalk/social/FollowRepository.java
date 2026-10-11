package com.cryptalk.social;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FollowRepository extends JpaRepository<Follow, FollowId> {
    org.springframework.data.domain.Page<Follow> findByFollowerId(Long followerId, org.springframework.data.domain.Pageable pageable);
    org.springframework.data.domain.Page<Follow> findByFollowingId(Long followingId, org.springframework.data.domain.Pageable pageable);
    long countByFollowerId(Long followerId);
    long countByFollowingId(Long followingId);
    List<Follow> findByFollowerIdOrderByCreatedAtDesc(Long followerId);
    List<Follow> findByFollowingIdOrderByCreatedAtDesc(Long followingId);
    @Query("select f.following.id from Follow f where f.follower.id = :memberId")
    List<Long> findFollowingMemberIds(@Param("memberId") Long memberId);
}
