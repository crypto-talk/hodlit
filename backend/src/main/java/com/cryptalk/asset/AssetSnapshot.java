package com.cryptalk.asset;

import com.cryptalk.coin.Coin;
import com.cryptalk.member.Member;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "asset_snapshots", uniqueConstraints = @UniqueConstraint(columnNames = {"member_id", "coin_id"}))
public class AssetSnapshot {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "member_id")
    private Member member;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "coin_id")
    private Coin coin;
    @Column(nullable = false, precision = 36, scale = 18)
    private BigDecimal quantity;
    @Column(name = "value_krw", nullable = false, precision = 24, scale = 2)
    private BigDecimal valueKrw;
    @Column(nullable = false)
    private boolean verified;
    @Column(name = "verification_status", nullable = false, length = 30)
    private String verificationStatus;
    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;
    @Column(name = "wallet_count", nullable = false)
    private int walletCount;
    @Column(name = "holding_since")
    private Instant holdingSince;
    @Column(name = "block_number")
    private Long blockNumber;
    @Column(name = "sync_status", nullable = false, length = 20)
    private String syncStatus;

    protected AssetSnapshot() {}
    public AssetSnapshot(Member member, Coin coin) { this.member = member; this.coin = coin; }
    public void capture(BigDecimal quantity, BigDecimal valueKrw, boolean verified, String status, int walletCount) {
        this.quantity = quantity; this.valueKrw = valueKrw; this.verified = verified; this.verificationStatus = status;
        this.walletCount = walletCount;
        this.syncStatus = "VERIFIED".equals(status) ? "READY" : "PARTIAL";
        this.capturedAt = Instant.now();
    }
    public String getHolderStatus() {
        if (walletCount == 0) return "NOT_CONNECTED";
        if (!"VERIFIED".equals(verificationStatus) || "STALE".equals(syncStatus)
            || "CACHED".equals(syncStatus)) return "UNKNOWN";
        return quantity != null && quantity.signum() > 0 ? "HOLDER" : "EMPTY";
    }
    public Coin getCoin() { return coin; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getValueKrw() { return valueKrw; }
    public boolean isVerified() { return verified; }
    public String getVerificationStatus() { return verificationStatus; }
    public Instant getCapturedAt() { return capturedAt; }
    public int getWalletCount() { return walletCount; }
    public Instant getHoldingSince() { return holdingSince; }
    public Long getBlockNumber() { return blockNumber; }
    public String getSyncStatus() { return syncStatus; }
}
