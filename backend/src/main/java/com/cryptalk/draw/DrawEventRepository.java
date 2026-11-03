package com.cryptalk.draw;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;

public interface DrawEventRepository extends JpaRepository<DrawEvent, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from DrawEvent e where e.id = :id")
    Optional<DrawEvent> lockById(Long id);
}
