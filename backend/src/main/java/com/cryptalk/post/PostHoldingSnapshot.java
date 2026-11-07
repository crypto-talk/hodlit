package com.cryptalk.post;

import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.asset.HoldingQuantityBand;
import com.cryptalk.badge.BadgeSnapshot;
import com.cryptalk.coin.Coin;
import com.cryptalk.coin.VerificationAvailability;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

@MappedSuperclass
public abstract class PostHoldingSnapshot {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coin_id")
    private Coin coin;
    @Column(name = "verification_availability", nullable = false, length = 20)
    private String verificationAvailability;
    @Column(name = "verification_level", length = 20)
    private String verificationLevel;
    @Column(name = "verified_holder", nullable = false)
    private boolean verifiedHolder;
    @Column(name = "quantity_band", length = 120)
    private String quantityBand;
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
    @Embedded
    private BadgeSnapshot badge;

    protected PostHoldingSnapshot() {}

    protected PostHoldingSnapshot(Coin coin, AssetSnapshot asset) {
        this.coin = coin;
        VerificationAvailability availability = coin.getVerificationAvailability();
        verificationAvailability = availability.name();
        capturedAt = Instant.now();
        if (availability != VerificationAvailability.SUPPORTED) {
            syncStatus = availability.name();
            return;
        }
        holderStatus = asset == null ? "NOT_CONNECTED" : asset.getHolderStatus();
        verifiedHolder = asset != null && asset.isVerified();
        verificationLevel = verifiedHolder ? asset.getVerificationLevel() : "UNVERIFIED";
        quantityBand = verifiedHolder ? HoldingQuantityBand.of(coin.getSymbol(), asset.getQuantity()) : null;
        Instant holdingSince = asset == null ? null : asset.getHoldingSince();
        holdingMonths = holdingSince == null ? null : Math.toIntExact(ChronoUnit.MONTHS.between(
            holdingSince.atZone(ZoneOffset.UTC).toLocalDate(), capturedAt.atZone(ZoneOffset.UTC).toLocalDate()));
        walletCount = asset == null ? 0 : asset.getWalletCount();
        blockNumber = asset == null ? null : asset.getBlockNumber();
        syncStatus = asset == null ? "NO_DATA" : asset.getSyncStatus();
    }

    public void applyBadge(BadgeSnapshot badge) {
        this.badge = badge;
        if (badge != null) quantityBand = badge.getQuantityBand();
    }

    public Coin getCoin() { return coin; }
    public String getHolderStatus() { return holderStatus; }
    public String getVerificationAvailability() { return verificationAvailability; }
    public String getVerificationLevel() { return verificationLevel; }
    public boolean isVerifiedHolder() { return verifiedHolder; }
    public String getQuantityBand() { return quantityBand; }
    public Integer getHoldingMonths() { return holdingMonths; }
    public int getWalletCount() { return walletCount; }
    public Instant getCapturedAt() { return capturedAt; }
    public Long getBlockNumber() { return blockNumber; }
    public String getSyncStatus() { return syncStatus; }
    public BadgeSnapshot getBadge() { return badge; }
}
