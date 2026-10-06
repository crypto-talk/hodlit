package com.cryptalk.draft;

import com.cryptalk.member.Member;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "drafts")
public class Draft {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id")
    private Member member;
    @Column(nullable = false, columnDefinition = "MEDIUMTEXT")
    private String payload;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Draft() {}
    public Draft(Member member, String payload) {
        this.member = member;
        update(payload);
    }
    public void update(String payload) {
        this.payload = payload;
        this.updatedAt = Instant.now();
    }
    public Long getId() { return id; }
    public Member getMember() { return member; }
    public String getPayload() { return payload; }
    public Instant getUpdatedAt() { return updatedAt; }
}
