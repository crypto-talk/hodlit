package com.cryptalk.badge;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "badge_tiers")
public class BadgeTier {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "coin_id", nullable = false) private Long coinId;
    @Column(name = "config_version", nullable = false) private long configVersion;
    @Column(name = "tier_order", nullable = false) private int tierOrder;
    @Column(name = "minimum_quantity", nullable = false, precision = 36, scale = 18) private BigDecimal minimumQuantity;
    @Column(nullable = false, length = 40) private String name;
    @Column(nullable = false, length = 20) private String icon;
    @Column(nullable = false, length = 20) private String color;
    @Column(nullable = false, length = 20) private String effect;
    protected BadgeTier() {}
    public BadgeTier(Long coinId, long version, int order, BadgeService.TierRequest request) {
        this.coinId = coinId;
        configVersion = version;
        tierOrder = order;
        minimumQuantity = request.minimumQuantity();
        name = request.name().strip();
        icon = request.icon();
        color = request.color();
        effect = request.effect();
    }
    public BigDecimal getMinimumQuantity() { return minimumQuantity; }
    public String getName() { return name; }
    public String getIcon() { return icon; }
    public String getColor() { return color; }
    public String getEffect() { return effect; }
    public long getConfigVersion() { return configVersion; }
}
