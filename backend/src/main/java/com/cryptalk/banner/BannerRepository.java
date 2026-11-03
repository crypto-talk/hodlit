package com.cryptalk.banner;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BannerRepository extends JpaRepository<Banner, Long> {
    List<Banner> findAllByOrderByDisplayOrderAscIdAsc();
    List<Banner> findByVisibleTrueOrderByDisplayOrderAscIdAsc();
    boolean existsByImageUrl(String imageUrl);
}
