package com.cryptalk.comment;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    @Query("""
        select c from Comment c where c.member.id = :memberId and c.post.coin.active = true
        and c.post.coin.operationStatus = com.cryptalk.coin.RoomOperationStatus.OPEN
        """)
    Page<Comment> publicMemberPage(@Param("memberId") Long memberId, Pageable pageable);

    @Query("""
        select count(c) from Comment c where c.member.id = :memberId and c.post.coin.active = true
        and c.post.coin.operationStatus = com.cryptalk.coin.RoomOperationStatus.OPEN
        """)
    long countPublicByMemberId(@Param("memberId") Long memberId);

    org.springframework.data.domain.Page<Comment> findByPostId(Long postId, org.springframework.data.domain.Pageable pageable);
    long countByPostId(Long postId);
    List<Comment> findByPostIdOrderByCreatedAt(Long postId);
}
