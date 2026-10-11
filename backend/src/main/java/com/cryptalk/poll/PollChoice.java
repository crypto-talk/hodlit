package com.cryptalk.poll;

import jakarta.persistence.*;

@Entity
@Table(name="poll_choices")
public class PollChoice {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="poll_id")
    private CommunityPoll poll;
    @Column(nullable=false, length=100)
    private String label;
    @Column(name="display_order", nullable=false)
    private int position;

    protected PollChoice() {}
    public PollChoice(CommunityPoll poll, String label, int position) {
        this.poll = poll;
        this.label = label;
        this.position = position;
    }
    public Long getId() { return id; }
    public String getLabel() { return label; }
}
