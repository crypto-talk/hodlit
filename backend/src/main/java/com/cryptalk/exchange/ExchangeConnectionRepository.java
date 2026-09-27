package com.cryptalk.exchange;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExchangeConnectionRepository extends JpaRepository<ExchangeConnection, Long> {
    List<ExchangeConnection> findByMemberIdOrderByExchangeAsc(Long memberId);
    Optional<ExchangeConnection> findByMemberIdAndExchange(Long memberId, Exchange exchange);
}
