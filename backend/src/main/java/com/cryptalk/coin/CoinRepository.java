package com.cryptalk.coin;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CoinRepository extends JpaRepository<Coin, Long> {
    String ACTIVE_CATALOG = "select c from Coin c where c.active = true "
        + "order by case when upper(c.symbol) = 'OTHER' then 1 else 0 end, c.displayOrder, c.id";

    boolean existsBySymbolIgnoreCase(String symbol);
    boolean existsByCategoryId(Long categoryId);
    @org.springframework.data.jpa.repository.Query("select c from Coin c where (lower(c.name) like :pattern escape '!' or lower(c.symbol) like :pattern escape '!') and (:status is null or c.operationStatus = :status)")
    org.springframework.data.domain.Page<Coin> adminRooms(@org.springframework.data.repository.query.Param("pattern") String pattern,
        @org.springframework.data.repository.query.Param("status") RoomOperationStatus status, org.springframework.data.domain.Pageable pageable);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Coin c where lower(c.symbol)=lower(:symbol)")
    Optional<Coin> lockBySymbol(@org.springframework.data.repository.query.Param("symbol") String symbol);
    @Query(ACTIVE_CATALOG)
    List<Coin> findByActiveTrueOrderByDisplayOrder();
    @Query(value = ACTIVE_CATALOG, countQuery = "select count(c) from Coin c where c.active = true")
    org.springframework.data.domain.Page<Coin> findByActiveTrue(org.springframework.data.domain.Pageable pageable);
    Optional<Coin> findBySymbolIgnoreCaseAndActiveTrue(String symbol);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Coin c where lower(c.symbol)=lower(:symbol) and c.active=true")
    Optional<Coin> lockActiveBySymbol(@org.springframework.data.repository.query.Param("symbol") String symbol);
}
