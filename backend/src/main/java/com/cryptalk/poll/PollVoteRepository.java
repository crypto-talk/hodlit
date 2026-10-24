package com.cryptalk.poll;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PollVoteRepository extends JpaRepository<PollVote,Long> {
    Optional<PollVote> findByPollIdAndMemberIdAndVoteDate(Long pollId, Long memberId, LocalDate day);
    @Query("select v.choice.id as choiceId, count(v) as votes from PollVote v where v.poll.id=:pollId and v.voteDate=:day group by v.choice.id")
    List<ChoiceCount> counts(@Param("pollId") Long pollId,@Param("day") LocalDate day);
    interface ChoiceCount {
        Long getChoiceId();
        Long getVotes();
    }
}
