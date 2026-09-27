package com.cryptalk.exchange;

import com.cryptalk.member.Member;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(name = "exchange_connections", uniqueConstraints = @UniqueConstraint(columnNames = {"member_id", "exchange"}))
public class ExchangeConnection {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Exchange exchange;

    @Column(name = "encrypted_access_key", nullable = false, length = 512)
    private String encryptedAccessKey;

    @Column(name = "encrypted_secret_key", nullable = false, length = 512)
    private String encryptedSecretKey;

    @Column(name = "connected_at", nullable = false)
    private Instant connectedAt;

    protected ExchangeConnection() {}

    public ExchangeConnection(Member member, Exchange exchange, String encryptedAccessKey, String encryptedSecretKey) {
        this.member = member;
        this.exchange = exchange;
        replace(encryptedAccessKey, encryptedSecretKey);
    }

    public void replace(String encryptedAccessKey, String encryptedSecretKey) {
        this.encryptedAccessKey = encryptedAccessKey;
        this.encryptedSecretKey = encryptedSecretKey;
        this.connectedAt = Instant.now();
    }

    public Long getId() { return id; }
    public Exchange getExchange() { return exchange; }
    public String getEncryptedAccessKey() { return encryptedAccessKey; }
    public String getEncryptedSecretKey() { return encryptedSecretKey; }
    public Instant getConnectedAt() { return connectedAt; }
}
