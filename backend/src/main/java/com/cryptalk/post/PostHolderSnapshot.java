package com.cryptalk.post;

import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.coin.VerificationAvailability;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "post_holder_snapshots")
public class PostHolderSnapshot extends PostHoldingSnapshot {
    @Id
    @Column(name = "post_id")
    private Long postId;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @MapsId @JoinColumn(name = "post_id")
    private Post post;
    @Column(name = "quantity_exact", precision = 36, scale = 18)
    private BigDecimal quantityExact;
    @Column(name = "holding_since")
    private Instant holdingSince;
    protected PostHolderSnapshot() {}

    public PostHolderSnapshot(Post post, AssetSnapshot asset) {
        super(post.getCoin(), asset);
        this.post = post;
        if (post.getCoin().getVerificationAvailability() == VerificationAvailability.SUPPORTED && asset != null) {
            quantityExact = asset.getQuantity();
            holdingSince = asset.getHoldingSince();
        }
    }
}
