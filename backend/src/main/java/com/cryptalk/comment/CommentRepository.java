package com.cryptalk.comment;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    org.springframework.data.domain.Page<Comment> findByPostId(Long postId, org.springframework.data.domain.Pageable pageable);
    long countByPostId(Long postId);
    List<Comment> findByPostIdOrderByCreatedAt(Long postId);
}
