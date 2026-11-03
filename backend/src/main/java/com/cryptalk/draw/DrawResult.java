package com.cryptalk.draw;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "draw_results", uniqueConstraints = @UniqueConstraint(columnNames = {"event_id", "member_id"}))
public class DrawResult {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "event_id", nullable = false) private Long eventId;
    @Column(name = "member_id", nullable = false) private Long memberId;
    @Column(name = "prize_id", nullable = false) private Long prizeId;
    @Column(name = "prize_name", nullable = false, length = 100) private String prizeName;
    @Column(name = "image_url", nullable = false, length = 1000) private String imageUrl;
    @Column(name = "captured_at", nullable = false) private Instant capturedAt = Instant.now();
    protected DrawResult() {}
    public DrawResult(Long eventId, Long memberId, DrawPrize prize) {
        this.eventId = eventId;
        this.memberId = memberId;
        prizeId = prize.getId();
        prizeName = prize.getName();
        imageUrl = prize.getImageUrl();
    }
    public Long getId() { return id; }
    public Long getEventId() { return eventId; }
    public Long getPrizeId() { return prizeId; }
    public String getPrizeName() { return prizeName; }
    public String getImageUrl() { return imageUrl; }
    public Instant getCapturedAt() { return capturedAt; }
}
