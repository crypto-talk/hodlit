package com.cryptalk.poll;

import com.cryptalk.member.Member;
import jakarta.persistence.*;
import java.time.LocalDate;

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

    protected PollVote() {}
    public PollVote(CommunityPoll poll, Member member, PollChoice choice, LocalDate day) {
        this.poll = poll;
        this.member = member;
        this.choice = choice;
        this.voteDate = day;
    }
    public PollChoice getChoice() { return choice; }
}
