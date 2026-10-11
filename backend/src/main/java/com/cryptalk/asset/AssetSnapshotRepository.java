package com.cryptalk.asset;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetSnapshotRepository extends JpaRepository<AssetSnapshot, Long> {
    Optional<AssetSnapshot> findByMemberIdAndCoinId(Long memberId, Long coinId);
    void deleteByMemberId(Long memberId);
    List<AssetSnapshot> findByMemberIdOrderByCoinDisplayOrder(Long memberId);
}
