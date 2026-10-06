package com.cryptalk.draft;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DraftRepository extends JpaRepository<Draft, Long> {
    List<Draft> findByMemberIdOrderByUpdatedAtDescIdDesc(Long memberId);
    long countByMemberId(Long memberId);
}
