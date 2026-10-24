package com.cryptalk.wallet;

import org.springframework.data.jpa.repository.JpaRepository;

public interface WalletConnectionEventRepository extends JpaRepository<WalletConnectionEvent, Long> {}
