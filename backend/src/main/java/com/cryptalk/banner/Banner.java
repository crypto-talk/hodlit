package com.cryptalk.banner;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "banners")
public class Banner {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 100) private String title;
    @Column(name = "image_url", nullable = false, length = 1000) private String imageUrl;
    @Column(name = "alt_text", nullable = false, length = 200) private String altText;
    @Column(name = "link_url", length = 1000) private String linkUrl;
    @Column(nullable = false) private boolean visible;
    @Column(name = "display_order", nullable = false) private int displayOrder;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = createdAt;

    protected Banner() {}
    public Banner(BannerService.SaveRequest request) { update(request); }
    public void update(BannerService.SaveRequest request) {
        title = request.title().strip();
        imageUrl = request.imageUrl();
        altText = request.altText().strip();
        linkUrl = request.linkUrl();
        visible = request.visible();
        reorder(request.displayOrder());
    }
    public void reorder(int order) { displayOrder = order; updatedAt = Instant.now(); }
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getImageUrl() { return imageUrl; }
    public String getAltText() { return altText; }
    public String getLinkUrl() { return linkUrl; }
    public boolean isVisible() { return visible; }
    public int getDisplayOrder() { return displayOrder; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
