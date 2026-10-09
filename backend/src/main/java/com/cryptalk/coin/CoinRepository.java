package com.cryptalk.coin;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoinRepository extends JpaRepository<Coin, Long> {
    List<Coin> findByActiveTrueOrderByDisplayOrder();
    org.springframework.data.domain.Page<Coin> findByActiveTrue(org.springframework.data.domain.Pageable pageable);
    Optional<Coin> findBySymbolIgnoreCaseAndActiveTrue(String symbol);
}
