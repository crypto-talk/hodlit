package com.cryptalk.poll;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PollVoteRepository extends JpaRepository<PollVote,Long> {
    Optional<PollVote> findByPollIdAndMemberIdAndVoteDate(Long pollId, Long memberId, LocalDate day);
    @Query("select v.choice.id as choiceId, count(v) as votes from PollVote v where v.poll.id=:pollId and v.voteDate=:day group by v.choice.id")
    List<ChoiceCount> counts(@Param("pollId") Long pollId,@Param("day") LocalDate day);
    Page<PollVote> findByMemberId(Long memberId, Pageable pageable);

    // Count (poll, day) groups explicitly: counting only distinct dates loses same-day questions.
    @Query(value="""
        SELECT v.poll_id AS pollId, v.vote_date AS voteDay
        FROM poll_votes v JOIN community_polls p ON p.id=v.poll_id
        WHERE p.coin_id=:coinId AND (v.vote_date<:today OR (p.active=false AND v.vote_date=:today))
        GROUP BY v.poll_id, v.vote_date ORDER BY v.vote_date DESC, v.poll_id DESC
        """, countQuery="""
        SELECT COUNT(*) FROM (
            SELECT v.poll_id, v.vote_date FROM poll_votes v JOIN community_polls p ON p.id=v.poll_id
            WHERE p.coin_id=:coinId AND (v.vote_date<:today OR (p.active=false AND v.vote_date=:today))
            GROUP BY v.poll_id, v.vote_date
        ) result_days
        """, nativeQuery=true)
    Page<ResultDay> roomResultDays(@Param("coinId") Long coinId, @Param("today") LocalDate today, Pageable pageable);

    @Query(value="select distinct v.voteDate from PollVote v where v.poll.id=:pollId and v.voteDate between :from and :to order by v.voteDate desc",
           countQuery="select count(distinct v.voteDate) from PollVote v where v.poll.id=:pollId and v.voteDate between :from and :to")
    Page<LocalDate> resultDays(@Param("pollId") Long pollId, @Param("from") LocalDate from,
                               @Param("to") LocalDate to, Pageable pageable);

    @Query("select coalesce(v.holderStatus, 'UNKNOWN') as holderStatus, v.choice.id as choiceId, count(v) as votes from PollVote v where v.poll.id=:pollId and v.voteDate=:day group by coalesce(v.holderStatus, 'UNKNOWN'), v.choice.id")
    List<HolderCount> holderCounts(@Param("pollId") Long pollId, @Param("day") LocalDate day);
    interface ResultDay {
        Long getPollId();
        LocalDate getVoteDay();
    }
    interface HolderCount extends ChoiceCount {
        String getHolderStatus();
    }
    interface ChoiceCount {
        Long getChoiceId();
        Long getVotes();
    }
}
