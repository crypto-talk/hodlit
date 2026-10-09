package com.cryptalk.coin;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoinRepository extends JpaRepository<Coin, Long> {
    List<Coin> findByActiveTrueOrderByDisplayOrder();
    Optional<Coin> findBySymbolIgnoreCaseAndActiveTrue(String symbol);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Coin c where lower(c.symbol)=lower(:symbol) and c.active=true")
    Optional<Coin> lockActiveBySymbol(@org.springframework.data.repository.query.Param("symbol") String symbol);
}
