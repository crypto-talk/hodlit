package com.cryptalk.post;

import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.coin.Coin;
import jakarta.persistence.*;

@Entity
@Table(name = "post_coin_snapshots")
public class PostCoinSnapshot extends PostHoldingSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id")
    private Post post;
    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    protected PostCoinSnapshot() {}

    public PostCoinSnapshot(Post post, Coin coin, AssetSnapshot asset, int displayOrder) {
        super(coin, asset);
        this.post = post;
        this.displayOrder = displayOrder;
    }
}
