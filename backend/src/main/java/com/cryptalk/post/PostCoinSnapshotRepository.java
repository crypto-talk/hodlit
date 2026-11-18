package com.cryptalk.post;

import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostCoinSnapshotRepository extends JpaRepository<PostCoinSnapshot, Long> {
    void deleteByPostId(Long postId);

    @EntityGraph(attributePaths = "coin")
    List<PostCoinSnapshot> findByPostIdOrderByDisplayOrder(Long postId);
}
