package com.cryptalk.post;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostBookmarkRepository extends JpaRepository<PostBookmark, PostMemberId> {
    List<PostBookmark> findByMemberIdOrderByCreatedAtDesc(Long memberId);
    org.springframework.data.domain.Page<PostBookmark> findByMemberId(Long memberId, org.springframework.data.domain.Pageable pageable);
}
