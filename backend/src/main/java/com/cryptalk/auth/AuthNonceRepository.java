package com.cryptalk.auth;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuthNonceRepository extends JpaRepository<AuthNonce, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from AuthNonce n where n.id = :id")
    Optional<AuthNonce> lockById(@Param("id") UUID id);
}
