package com.cryptalk.poll;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PollRepository extends JpaRepository<CommunityPoll,Long> {
    Optional<CommunityPoll> findFirstByCoinIdAndActiveTrueOrderByCreatedAtDescIdDesc(Long coinId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from CommunityPoll p where p.id=:id")
    Optional<CommunityPoll> lockById(@Param("id") Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<CommunityPoll> findByCoinIdAndActiveTrue(Long coinId);
}
