package com.cryptalk.poll;

import com.cryptalk.member.Member;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.Instant;
import java.math.BigDecimal;
import com.cryptalk.asset.AssetSnapshot;
import com.cryptalk.asset.HoldingQuantityBand;
import com.cryptalk.coin.VerificationAvailability;
import com.cryptalk.market.MarketPriceService.PriceQuote;

@Entity
@Table(name="poll_votes", uniqueConstraints=@UniqueConstraint(columnNames={"poll_id","member_id","vote_date"}))
public class PollVote {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="poll_id")
    private CommunityPoll poll;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="member_id")
    private Member member;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="choice_id")
    private PollChoice choice;
    @Column(name="vote_date", nullable=false)
    private LocalDate voteDate;
    @Column(name="voted_at")
    private Instant votedAt;
    @Column(precision=36, scale=18)
    private BigDecimal price;
    @Column(name="price_currency", length=10)
    private String priceCurrency;
    @Column(name="price_source", length=30)
    private String priceSource;
    @Column(name="price_captured_at")
    private Instant priceCapturedAt;
    @Column(name="holder_status", length=20)
    private String holderStatus;
    @Column(name="quantity_band", length=40)
    private String quantityBand;

    protected PollVote() {}
    public PollVote(CommunityPoll poll, Member member, PollChoice choice, LocalDate day) {
        this.poll = poll;
        this.member = member;
        this.choice = choice;
        this.voteDate = day;
    }
    public PollChoice getChoice() { return choice; }
    public void capture(Instant votedAt, PriceQuote quote, AssetSnapshot asset) {
        this.votedAt = votedAt;
        if (quote != null) {
            price = quote.price();
            priceCurrency = quote.currency();
            priceSource = quote.source();
            priceCapturedAt = quote.capturedAt();
        }
        holderStatus = poll.getCoin().getVerificationAvailability() != VerificationAvailability.SUPPORTED
            ? "UNKNOWN" : asset == null ? "NOT_CONNECTED" : asset.getHolderStatus();
        quantityBand = "HOLDER".equals(holderStatus)
            ? HoldingQuantityBand.of(poll.getCoin().getSymbol(), asset.getQuantity()) : null;
    }
    public Long getId() { return id; }
    public CommunityPoll getPoll() { return poll; }
    public LocalDate getVoteDate() { return voteDate; }
    public Instant getVotedAt() { return votedAt; }
}
