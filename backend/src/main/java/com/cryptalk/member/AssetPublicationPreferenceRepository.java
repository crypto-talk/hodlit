package com.cryptalk.member;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetPublicationPreferenceRepository extends JpaRepository<AssetPublicationPreference, Long> {
    List<AssetPublicationPreference> findByMemberId(Long memberId);
    Optional<AssetPublicationPreference> findByMemberIdAndCoinId(Long memberId, Long coinId);
}
