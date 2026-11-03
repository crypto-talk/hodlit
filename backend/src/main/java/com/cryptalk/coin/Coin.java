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
    @Enumerated(EnumType.STRING)
    @Column(name = "operation_status", nullable = false, length = 10)
    private RoomOperationStatus operationStatus = RoomOperationStatus.CLOSE;

    public RoomOperationStatus getOperationStatus() { return operationStatus; }
    public void changeOperationStatus(RoomOperationStatus status) { this.operationStatus = status; }
    @Column(name = "category_id") private Long categoryId;
    public Long getCategoryId() { return categoryId; }
    public int getDisplayOrder() { return displayOrder; }
    public Coin(String symbol, String name, int displayOrder, Long categoryId) {
        this.symbol = symbol;
        this.name = name;
        this.displayOrder = displayOrder;
        this.categoryId = categoryId;
        chainType = "OTHER";
        accentColor = "#64748b";
        verificationAvailability = VerificationAvailability.NOT_SUPPORTED;
        active = true;
    }
    public void updateCatalog(String name, int displayOrder, Long categoryId, boolean active) {
        this.name = name;
        this.displayOrder = displayOrder;
        this.categoryId = categoryId;
        this.active = active;
        if (!active) operationStatus = RoomOperationStatus.CLOSE;
    }
    protected Coin() {}
    public void enableVerification() { this.verificationAvailability = VerificationAvailability.SUPPORTED; }
    public boolean isActive() { return active; }
    public Long getId() { return id; }
    public String getSymbol() { return symbol; }
    public String getName() { return name; }
    public String getChainType() { return chainType; }
    public String getContractAddress() { return contractAddress; }
    public String getAccentColor() { return accentColor; }
    public String getMarketPriceId() { return marketPriceId; }
    public VerificationAvailability getVerificationAvailability() { return verificationAvailability; }
    public Long getChainId() { return chainId; }
    public String getAssetType() { return assetType; }
    public Integer getTokenDecimals() { return tokenDecimals; }
}
