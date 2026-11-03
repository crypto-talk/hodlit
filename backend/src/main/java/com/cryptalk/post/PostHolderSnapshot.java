package com.cryptalk.post;

import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.coin.Coin;
import com.cryptalk.coin.VerificationAvailability;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "post_holder_snapshots")
public class PostHolderSnapshot {
    @Id
    @Column(name = "post_id")
    private Long postId;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @MapsId @JoinColumn(name = "post_id")
    private Post post;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "coin_id")
    private Coin coin;
    @Column(name = "verification_availability", nullable = false, length = 20)
    private String verificationAvailability;
    @Column(name = "verification_level", length = 20)
    private String verificationLevel;
    @Column(name = "verified_holder", nullable = false)
    private boolean verifiedHolder;
    @Column(name = "quantity_exact", precision = 36, scale = 18)
    private BigDecimal quantityExact;
    @Column(name = "quantity_band", length = 120)
    private String quantityBand;
    @Column(name = "holding_since")
    private Instant holdingSince;
    @Column(name = "holding_months")
    private Integer holdingMonths;
    @Column(name = "wallet_count", nullable = false)
    private int walletCount;
    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;
    @Column(name = "block_number")
    private Long blockNumber;
    @Column(name = "sync_status", nullable = false, length = 20)
    private String syncStatus;

    @Column(name = "holder_status", nullable = false, length = 20)
    private String holderStatus = "UNKNOWN";

    @Embedded private com.cryptalk.badge.BadgeSnapshot badge;
    public com.cryptalk.badge.BadgeSnapshot getBadge() { return badge; }
    public void applyBadge(com.cryptalk.badge.BadgeSnapshot badge) {
        this.badge = badge;
        if (badge != null) this.quantityBand = badge.getQuantityBand();
    }
    protected PostHolderSnapshot() {}

    public PostHolderSnapshot(Post post, AssetSnapshot asset) {
        this.post = post;
        this.coin = post.getCoin();
        VerificationAvailability availability = coin.getVerificationAvailability();
        this.verificationAvailability = availability.name();
        this.capturedAt = Instant.now();
        if (availability != VerificationAvailability.SUPPORTED) {
            this.walletCount = 0;
            this.syncStatus = availability.name();
            return;
        }
        this.holderStatus = asset == null ? "NOT_CONNECTED" : asset.getHolderStatus();
        this.verificationLevel = asset != null && asset.isVerified() ? asset.getVerificationLevel() : "UNVERIFIED";
        this.verifiedHolder = asset != null && asset.isVerified();
        this.quantityExact = asset == null ? null : asset.getQuantity();
        this.quantityBand = verifiedHolder ? com.cryptalk.asset.HoldingQuantityBand.of(coin.getSymbol(), quantityExact) : null;
        this.holdingSince = asset == null ? null : asset.getHoldingSince();
        this.holdingMonths = holdingSince == null ? null : Math.toIntExact(ChronoUnit.MONTHS.between(
            holdingSince.atZone(java.time.ZoneOffset.UTC).toLocalDate(), capturedAt.atZone(java.time.ZoneOffset.UTC).toLocalDate()));
        this.walletCount = asset == null ? 0 : asset.getWalletCount();
        this.blockNumber = asset == null ? null : asset.getBlockNumber();
        this.syncStatus = asset == null ? "NO_DATA" : asset.getSyncStatus();
    }


    public String getHolderStatus() {
        return holderStatus;
    }
    public String getVerificationAvailability() { return verificationAvailability; }
    public String getVerificationLevel() { return verificationLevel; }
    public boolean isVerifiedHolder() { return verifiedHolder; }
    public String getQuantityBand() { return quantityBand; }
    public Integer getHoldingMonths() { return holdingMonths; }
    public int getWalletCount() { return walletCount; }
    public Instant getCapturedAt() { return capturedAt; }
    public Long getBlockNumber() { return blockNumber; }
    public String getSyncStatus() { return syncStatus; }
}
