package com.cryptalk.draw;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DrawResultRepository extends JpaRepository<DrawResult, Long> {
    Optional<DrawResult> findByEventIdAndMemberId(Long eventId, Long memberId);
    boolean existsByImageUrl(String imageUrl);
    boolean existsByEventId(Long eventId);
}
