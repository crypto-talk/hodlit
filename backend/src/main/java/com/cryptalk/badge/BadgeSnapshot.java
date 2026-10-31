package com.cryptalk.badge;

import jakarta.persistence.*;

/** Only coarse publication-time data. Never contains exact holdings. */
@Embeddable
public class BadgeSnapshot {
    @Column(name = "badge_version") private Long version;
    @Column(name = "badge_name", length = 40) private String name;
    @Column(name = "badge_band", length = 120) private String quantityBand;
    @Column(name = "badge_icon", length = 20) private String icon;
    @Column(name = "badge_color", length = 20) private String color;
    @Column(name = "badge_effect", length = 20) private String effect;
    protected BadgeSnapshot() {}
    public BadgeSnapshot(BadgeTier tier, String band) {
        version = tier.getConfigVersion();
        name = tier.getName();
        quantityBand = band;
        icon = tier.getIcon();
        color = tier.getColor();
        effect = tier.getEffect();
    }
    public Long getVersion() { return version; }
    public String getName() { return name; }
    public String getQuantityBand() { return quantityBand; }
    public String getIcon() { return icon; }
    public String getColor() { return color; }
    public String getEffect() { return effect; }
}
