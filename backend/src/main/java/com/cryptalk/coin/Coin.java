package com.cryptalk.coin;

import jakarta.persistence.*;

@Entity
@Table(name = "coins")
public class Coin {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 20)
    private String symbol;
    @Column(nullable = false, length = 80)
    private String name;
    @Column(name = "chain_type", nullable = false, length = 20)
    private String chainType;
    @Column(name = "contract_address", length = 80)
    private String contractAddress;
    @Column(name = "accent_color", nullable = false, length = 20)
    private String accentColor;
    @Column(name = "display_order", nullable = false)
    private int displayOrder;
    @Column(name = "market_price_id", length = 100)
    private String marketPriceId;
    @Enumerated(EnumType.STRING)
    @Column(name = "verification_availability", nullable = false, length = 20)
    private VerificationAvailability verificationAvailability;
    @Column(name = "chain_id")
    private Long chainId;
    @Column(name = "asset_type", length = 20)
    private String assetType;
    @Column(name = "token_decimals")
    private Integer tokenDecimals;
    @Column(nullable = false)
    private boolean active;
    protected Coin() {}
    public boolean isActive() { return active; }
    public Long getId() { return id; }
    public String getSymbol() { return symbol; }
    public String getName() { return name; }
    public String getChainType() { return chainType; }
    public String getAccentColor() { return accentColor; }
    public String getMarketPriceId() { return marketPriceId; }
    public VerificationAvailability getVerificationAvailability() { return verificationAvailability; }
    public Long getChainId() { return chainId; }
    public String getAssetType() { return assetType; }
    public Integer getTokenDecimals() { return tokenDecimals; }
}
