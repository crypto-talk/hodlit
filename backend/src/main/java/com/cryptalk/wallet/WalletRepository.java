package com.cryptalk.wallet;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalletRepository extends JpaRepository<Wallet, Long> {
    Optional<Wallet> findByChainTypeAndAddress(String chainType, String address);
    Optional<Wallet> findFirstByMemberId(Long memberId);
    List<Wallet> findByMemberIdOrderByCreatedAtAsc(Long memberId);
    org.springframework.data.domain.Page<Wallet> findByMemberId(Long memberId, org.springframework.data.domain.Pageable pageable);
}
