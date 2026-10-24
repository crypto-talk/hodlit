package com.cryptalk.coin;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoinRepository extends JpaRepository<Coin, Long> {
    @org.springframework.data.jpa.repository.Query("select c from Coin c where (lower(c.name) like :pattern escape '!' or lower(c.symbol) like :pattern escape '!') and (:status is null or c.operationStatus = :status)")
    org.springframework.data.domain.Page<Coin> adminRooms(@org.springframework.data.repository.query.Param("pattern") String pattern,
        @org.springframework.data.repository.query.Param("status") RoomOperationStatus status, org.springframework.data.domain.Pageable pageable);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Coin c where lower(c.symbol)=lower(:symbol)")
    Optional<Coin> lockBySymbol(@org.springframework.data.repository.query.Param("symbol") String symbol);
    List<Coin> findByActiveTrueOrderByDisplayOrder();
    org.springframework.data.domain.Page<Coin> findByActiveTrue(org.springframework.data.domain.Pageable pageable);
    Optional<Coin> findBySymbolIgnoreCaseAndActiveTrue(String symbol);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Coin c where lower(c.symbol)=lower(:symbol) and c.active=true")
    Optional<Coin> lockActiveBySymbol(@org.springframework.data.repository.query.Param("symbol") String symbol);
}
