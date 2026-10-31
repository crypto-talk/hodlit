package com.cryptalk.member;

import jakarta.persistence.*;

@Entity
@Table(name = "asset_publication_preferences", uniqueConstraints = @UniqueConstraint(columnNames = {"member_id", "coin_id"}))
public class AssetPublicationPreference {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "member_id", nullable = false) private Long memberId;
    @Column(name = "coin_id", nullable = false) private Long coinId;
    @Column(nullable = false) private boolean visible;
    protected AssetPublicationPreference() {}
    public AssetPublicationPreference(Long memberId, Long coinId, boolean visible) { this.memberId = memberId; this.coinId = coinId; this.visible = visible; }
    public void setVisible(boolean visible) { this.visible = visible; }
    public Long getCoinId() { return coinId; }
    public boolean isVisible() { return visible; }
}
