package com.cryptalk.coin;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;

public interface RoomCategoryRepository extends JpaRepository<RoomCategory, Long> {
    List<RoomCategory> findAllByOrderByDisplayOrderAscIdAsc();
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from RoomCategory c where c.id=:id")
    Optional<RoomCategory> lockById(Long id);
}
