package com.cryptalk.post;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;

public interface PostRepository extends JpaRepository<Post, Long> {
    long countByCoinId(Long coinId);
    List<Post> findByCoinSymbolIgnoreCaseOrderByCreatedAtDesc(String symbol, Pageable pageable);
    List<Post> findAllByOrderByCreatedAtDesc(Pageable pageable);
    List<Post> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
    List<Post> findByCreatedAtLessThanEqualOrderByCreatedAtDescIdDesc(Instant before, Pageable pageable);
    @Query("select p from Post p where p.member.id in :memberIds order by p.createdAt desc, p.id desc")
    List<Post> findFollowing(@Param("memberIds") List<Long> memberIds, Pageable pageable);
    @Query("select p from Post p where p.member.id in :memberIds and p.createdAt <= :before order by p.createdAt desc, p.id desc")
    List<Post> findFollowingBefore(@Param("memberIds") List<Long> memberIds, @Param("before") Instant before, Pageable pageable);
}
