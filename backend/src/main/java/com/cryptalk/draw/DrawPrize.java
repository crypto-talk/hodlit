package com.cryptalk.draw;

import jakarta.persistence.*;

@Entity
@Table(name = "draw_prizes")
public class DrawPrize {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "event_id") private DrawEvent event;
    @Column(nullable = false, length = 100) private String name;
    @Column(name = "image_url", nullable = false, length = 1000) private String imageUrl;
    @Column(nullable = false, length = 1000) private String description;
    @Column(nullable = false) private long weight;
    @Column(name = "display_order", nullable = false) private int displayOrder;
    protected DrawPrize() {}
    public DrawPrize(DrawEvent event, DrawService.PrizeRequest request) {
        this.event = event;
        name = request.name().strip();
        imageUrl = request.imageUrl();
        description = request.description();
        weight = request.weight();
        displayOrder = request.displayOrder();
    }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getImageUrl() { return imageUrl; }
    public String getDescription() { return description; }
    public long getWeight() { return weight; }
    public int getDisplayOrder() { return displayOrder; }
}
