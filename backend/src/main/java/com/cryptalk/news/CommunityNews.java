package com.cryptalk.news;

import com.cryptalk.coin.Coin;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="community_news")
public class CommunityNews {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="coin_id")
    private Coin coin;
    @Column(nullable=false, length=200)
    private String title;
    @Column(nullable=false, length=1000)
    private String summary;
    @Column(name="source_name", nullable=false, length=100)
    private String sourceName;
    @Column(name="source_url", nullable=false, length=1000)
    private String sourceUrl;
    @Column(name="created_at", nullable=false)
    private Instant createdAt;
    @Column(name="updated_at", nullable=false)
    private Instant updatedAt;

    protected CommunityNews() {}
    public CommunityNews(Coin coin, NewsDtos.SaveNewsRequest request) {
        this.coin = coin;
        this.createdAt = Instant.now();
        update(request);
    }
    public void update(NewsDtos.SaveNewsRequest request) {
        this.title = request.title().strip();
        this.summary = request.summary().strip();
        this.sourceName = request.sourceName().strip();
        this.sourceUrl = request.sourceUrl().strip();
        this.updatedAt = Instant.now();
    }
    public Long getId() { return id; }
    public Coin getCoin() { return coin; }
    public String getTitle() { return title; }
    public String getSummary() { return summary; }
    public String getSourceName() { return sourceName; }
    public String getSourceUrl() { return sourceUrl; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
