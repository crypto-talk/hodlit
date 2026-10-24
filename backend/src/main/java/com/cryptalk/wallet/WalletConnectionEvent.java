package com.cryptalk.wallet;

import com.cryptalk.member.Member;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "wallet_connection_events")
public class WalletConnectionEvent {
    public enum EventType { CONNECTED, DISCONNECTED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "member_id")
    private Member member;
    @Column(name = "wallet_id")
    private Long walletId;
    @Enumerated(EnumType.STRING) @Column(name = "event_type", nullable = false, length = 20)
    private EventType eventType;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected WalletConnectionEvent() {}
    public WalletConnectionEvent(Member member, Wallet wallet, EventType eventType) {
        this.member = member; this.walletId = wallet.getId(); this.eventType = eventType; this.createdAt = Instant.now();
    }
}
