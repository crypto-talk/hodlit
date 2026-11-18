package com.cryptalk.draw;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "draw_events")
public class DrawEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 100) private String title;
    @Column(nullable = false, length = 2000) private String description;
    @Column(name = "starts_at", nullable = false) private Instant startsAt;
    @Column(name = "ends_at", nullable = false) private Instant endsAt;
    @Column(nullable = false, length = 20) private String status = "DRAFT";
    @Column(nullable = false) private boolean published;

    protected DrawEvent() {}
    public DrawEvent(DrawService.EventRequest request) { update(request); }
    public void update(DrawService.EventRequest request) {
        title = request.title().strip();
        description = request.description();
        startsAt = request.startsAt();
        endsAt = request.endsAt();
    }
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public Instant getStartsAt() { return startsAt; }
    public Instant getEndsAt() { return endsAt; }
    public String getStatus() { return status; }
    public boolean isPublished() { return published; }
    public void changeStatus(String status) {
        this.status = status;
        if (status.equals("ACTIVE")) published = true;
    }
}
