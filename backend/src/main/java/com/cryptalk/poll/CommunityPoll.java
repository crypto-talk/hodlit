package com.cryptalk.poll;

import com.cryptalk.coin.Coin;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name="community_polls")
public class CommunityPoll {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch=FetchType.LAZY, optional=false)
    @JoinColumn(name="coin_id")
    private Coin coin;
    @Column(nullable=false, length=200)
    private String question;
    @Column(nullable=false)
    private boolean active;
    @Column(name="created_at", nullable=false)
    private Instant createdAt;
    @OneToMany(mappedBy="poll", cascade=CascadeType.ALL)
    @OrderBy("position ASC")
    private List<PollChoice> choices = new ArrayList<>();

    protected CommunityPoll() {}
    public CommunityPoll(Coin coin, String question, List<String> labels) {
        this.coin = coin;
        this.question = question.strip();
        this.active = true;
        this.createdAt = Instant.now();
        for (int i=0; i<labels.size(); i++) choices.add(new PollChoice(this,labels.get(i).strip(),i));
    }
    public void close() { active = false; }
    public Long getId() { return id; }
    public Coin getCoin() { return coin; }
    public String getQuestion() { return question; }
    public boolean isActive() { return active; }
    public List<PollChoice> getChoices() { return choices; }
}
