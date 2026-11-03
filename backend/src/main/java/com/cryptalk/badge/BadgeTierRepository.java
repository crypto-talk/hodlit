package com.cryptalk.badge;

import java.util.List;
import org.springframework.data.jpa.repository.*;

public interface BadgeTierRepository extends JpaRepository<BadgeTier, Long> {
    @Query("select coalesce(max(t.configVersion),0) from BadgeTier t where t.coinId = :coinId")
    long latestVersion(Long coinId);
    List<BadgeTier> findByCoinIdAndConfigVersionOrderByTierOrder(Long coinId, long configVersion);
}
