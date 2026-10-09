package com.cryptalk.news;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NewsRepository extends JpaRepository<CommunityNews, Long> {
    Page<CommunityNews> findByCoinId(Long coinId, Pageable pageable);
}
