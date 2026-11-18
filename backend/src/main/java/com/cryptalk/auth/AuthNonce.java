package com.cryptalk.auth;

import com.cryptalk.wallet.WalletChain;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "auth_nonces")
public class AuthNonce {
    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    private UUID id;
    @Column(name = "wallet_address", nullable = false, length = 80)
    private String walletAddress;
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "chain_type", nullable = false, length = 20)
    private WalletChain chainType;
    @Column(nullable = false, length = 20)
    private String purpose;
    @Column(name = "member_id")
    private Long memberId;
    @Column(nullable = false, length = 100)
    private String nonce;
    @Column(nullable = false, length = 1000)
    private String message;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(name = "used_at")
    private Instant usedAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AuthNonce() {}
    public AuthNonce(String walletAddress, WalletChain chainType, String purpose, Long memberId, String nonce, String message) {
        this.id = UUID.randomUUID();
        this.walletAddress = walletAddress;
        this.chainType = chainType;
        this.purpose = purpose;
        this.memberId = memberId;
        this.nonce = nonce;
        this.message = message;
        this.createdAt = Instant.now();
        this.expiresAt = createdAt.plusSeconds(300);
    }
    public UUID getId() { return id; }
    public String getWalletAddress() { return walletAddress; }
    public WalletChain getChainType() { return chainType; }
    public String getPurpose() { return purpose; }
    public Long getMemberId() { return memberId; }
    public String getMessage() { return message; }
    public boolean isUsable() { return usedAt == null && expiresAt.isAfter(Instant.now()); }
    public void use() { usedAt = Instant.now(); }
}
