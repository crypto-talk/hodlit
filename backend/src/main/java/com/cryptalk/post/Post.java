package com.cryptalk.post;

import com.cryptalk.coin.Coin;
import com.cryptalk.member.Member;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "posts")
public class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "member_id")
    private Member member;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "coin_id")
    private Coin coin;
    @Column(nullable = false, length = 120)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
    @Column(name = "author_asset_value_krw", precision = 24, scale = 2)
    private BigDecimal authorAssetValueKrw;
    @Column(name = "author_verified", nullable = false)
    private boolean authorVerified;
    @Column(name = "tradingview_symbol", length = 80)
    private String tradingViewSymbol;
    @Column(name = "tradingview_interval", length = 10)
    private String tradingViewInterval;
    @Column(name = "tradingview_analysis", columnDefinition = "TEXT")
    private String tradingViewAnalysis;
    @Column(name = "asset_price", precision = 30, scale = 8)
    private BigDecimal assetPrice;
    @Column(name = "asset_price_currency", length = 10)
    private String assetPriceCurrency;
    @Column(name = "asset_price_at")
    private Instant assetPriceAt;
    @Column(name = "asset_price_source", length = 30)
    private String assetPriceSource;
    @Column(name = "youtube_url", length = 500)
    private String youtubeUrl;
    @Column(name = "youtube_video_id", length = 20)
    private String youtubeVideoId;
    @Column(name = "youtube_thumbnail_url", length = 500)
    private String youtubeThumbnailUrl;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Post() {}
    public Post(Member member, Coin coin, String title, String content, BigDecimal assetValue, boolean verified,
                String tradingViewSymbol, String tradingViewInterval, String tradingViewAnalysis,
                BigDecimal assetPrice, String assetPriceCurrency, Instant assetPriceAt, String assetPriceSource,
                String youtubeUrl, String youtubeVideoId, String youtubeThumbnailUrl) {
        this.member = member; this.coin = coin; this.title = title; this.content = content;
        this.authorAssetValueKrw = assetValue; this.authorVerified = verified;
        this.tradingViewSymbol = tradingViewSymbol; this.tradingViewInterval = tradingViewInterval; this.tradingViewAnalysis = tradingViewAnalysis;
        this.assetPrice = assetPrice; this.assetPriceCurrency = assetPriceCurrency; this.assetPriceAt = assetPriceAt; this.assetPriceSource = assetPriceSource;
        this.youtubeUrl = youtubeUrl; this.youtubeVideoId = youtubeVideoId; this.youtubeThumbnailUrl = youtubeThumbnailUrl;
        this.createdAt = Instant.now(); this.updatedAt = createdAt;
    }
    public Long getId() { return id; }
    public Member getMember() { return member; }
    public Coin getCoin() { return coin; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public BigDecimal getAuthorAssetValueKrw() { return authorAssetValueKrw; }
    public boolean isAuthorVerified() { return authorVerified; }
    public String getTradingViewSymbol() { return tradingViewSymbol; }
    public String getTradingViewInterval() { return tradingViewInterval; }
    public String getTradingViewAnalysis() { return tradingViewAnalysis; }
    public BigDecimal getAssetPrice() { return assetPrice; }
    public String getAssetPriceCurrency() { return assetPriceCurrency; }
    public Instant getAssetPriceAt() { return assetPriceAt; }
    public String getAssetPriceSource() { return assetPriceSource; }
    public String getYoutubeUrl() { return youtubeUrl; }
    public String getYoutubeVideoId() { return youtubeVideoId; }
    public String getYoutubeThumbnailUrl() { return youtubeThumbnailUrl; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void update(String title, String content, String tradingViewSymbol, String tradingViewInterval,
                       String tradingViewAnalysis, String youtubeUrl,
                       String youtubeVideoId, String youtubeThumbnailUrl) {
        this.title = title.trim(); this.content = content.trim();
        this.tradingViewSymbol = tradingViewSymbol; this.tradingViewInterval = tradingViewInterval;
        this.tradingViewAnalysis = tradingViewAnalysis; this.youtubeUrl = youtubeUrl;
        this.youtubeVideoId = youtubeVideoId; this.youtubeThumbnailUrl = youtubeThumbnailUrl;
        this.updatedAt = Instant.now();
    }
}
