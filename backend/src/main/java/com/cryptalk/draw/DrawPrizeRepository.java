package com.cryptalk.draw;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DrawPrizeRepository extends JpaRepository<DrawPrize, Long> {
    List<DrawPrize> findByEventIdOrderByDisplayOrderAscIdAsc(Long eventId);
    boolean existsByImageUrl(String imageUrl);
    void deleteByEventId(Long eventId);
}
