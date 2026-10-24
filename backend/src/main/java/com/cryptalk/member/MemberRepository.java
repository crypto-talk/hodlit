package com.cryptalk.member;

import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemberRepository extends JpaRepository<Member, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select member from Member member where member.id = :id")
    Optional<Member> lockById(@Param("id") Long id);
    Optional<Member> findByNickname(String nickname);
    Optional<Member> findByLoginIdIgnoreCase(String loginId);
}
