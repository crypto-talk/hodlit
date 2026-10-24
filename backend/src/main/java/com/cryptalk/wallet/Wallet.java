package com.cryptalk.wallet;

import com.cryptalk.member.Member;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "wallets", uniqueConstraints = @UniqueConstraint(columnNames = {"chain_type", "address"}))
public class Wallet {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id")
    private Member member;
    @Column(name = "chain_type", nullable = false, length = 20)
    private String chainType;
    @Column(nullable = false, length = 80)
    private String address;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Wallet() {}
    public Wallet(Member member, String address) {
        this.member = member; this.address = address.toLowerCase(); this.chainType = "EVM"; this.createdAt = Instant.now();
    }
    public Long getId() { return id; }
    public Member getMember() { return member; }
    public String getChainType() { return chainType; }
    public String getAddress() { return address; }
    public Instant getCreatedAt() { return createdAt; }
}
