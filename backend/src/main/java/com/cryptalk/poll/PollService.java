package com.cryptalk.poll;

import com.cryptalk.admin.AdminAccess;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.common.ApiException;
import com.cryptalk.member.MemberRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PollService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final PollRepository polls;
    private final PollVoteRepository votes;
    private final CoinRepository coins;
    private final MemberRepository members;
    private final AdminAccess admins;
    private final Clock clock;

    public PollService(PollRepository polls,PollVoteRepository votes,CoinRepository coins,MemberRepository members,
                       AdminAccess admins,@Qualifier("pollClock") Clock clock) {
        this.polls = polls;
        this.votes = votes;
        this.coins = coins;
        this.members = members;
        this.admins = admins;
        this.clock = clock;
    }

    @Transactional
    public PollDtos.PollResponse create(Long memberId,String symbol,PollDtos.CreatePollRequest request) {
        admins.requireAdmin(memberId);
        if (request.choices().stream().map(value -> value.strip().toLowerCase(Locale.ROOT)).distinct().count() != request.choices().size())
            throw new ApiException(HttpStatus.BAD_REQUEST,"중복 선택지는 허용하지 않습니다.");
        var coin = coins.lockActiveBySymbol(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"코인 방을 찾을 수 없습니다."));
        polls.findByCoinIdAndActiveTrue(coin.getId()).forEach(CommunityPoll::close);
        var poll = polls.saveAndFlush(new CommunityPoll(coin,request.question(),request.choices()));
        return response(poll,memberId,today());
    }

    @Transactional(readOnly=true)
    public PollDtos.PollResponse current(String symbol,Long memberId) {
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"코인 방을 찾을 수 없습니다."));
        var poll = polls.findFirstByCoinIdAndActiveTrueOrderByCreatedAtDescIdDesc(coin.getId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"현재 투표가 없습니다."));
        return response(poll,memberId,today());
    }

    @Transactional(readOnly=true)
    public PollDtos.PollResponse get(Long pollId,Long memberId) {
        return response(polls.findById(pollId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"투표를 찾을 수 없습니다.")),memberId,today());
    }

    @Transactional
    public PollDtos.PollResponse vote(Long memberId,Long pollId,Long choiceId) {
        var member = members.lockById(memberId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다."));
        var poll = polls.lockById(pollId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"투표를 찾을 수 없습니다."));
        if (!poll.isActive() || !poll.getCoin().isActive()) throw new ApiException(HttpStatus.CONFLICT,"종료된 투표입니다.");
        LocalDate day = today(); // Capture after locks: one KST day for validation, insertion and response.
        if (votes.findByPollIdAndMemberIdAndVoteDate(pollId,memberId,day).isPresent())
            throw new ApiException(HttpStatus.CONFLICT,"오늘 이미 참여했습니다. 선택 변경은 불가능합니다.");
        var choice = poll.getChoices().stream().filter(item -> item.getId().equals(choiceId)).findFirst()
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,"해당 투표의 선택지가 아닙니다."));
        votes.saveAndFlush(new PollVote(poll,member,choice,day));
        return response(poll,memberId,day);
    }

    @Transactional
    public void close(Long memberId,Long pollId) {
        admins.requireAdmin(memberId);
        polls.lockById(pollId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"투표를 찾을 수 없습니다.")).close();
    }

    private LocalDate today() { return LocalDate.ofInstant(clock.instant(),SEOUL); }

    private PollDtos.PollResponse response(CommunityPoll poll,Long memberId,LocalDate day) {
        var participation = memberId == null ? null : votes.findByPollIdAndMemberIdAndVoteDate(poll.getId(),memberId,day).orElse(null);
        Map<Long,Long> counts = new HashMap<>();
        Long total = null;
        if (participation != null) { // Never even query aggregates for an unparticipating viewer.
            votes.counts(poll.getId(),day).forEach(row -> counts.put(row.getChoiceId(),row.getVotes()));
            total = counts.values().stream().mapToLong(Long::longValue).sum();
        }
        var choices = poll.getChoices().stream().map(item -> new PollDtos.ChoiceResponse(item.getId(),item.getLabel(),
            participation == null ? null : counts.getOrDefault(item.getId(),0L))).toList();
        return new PollDtos.PollResponse(poll.getId(),poll.getCoin().getSymbol(),poll.getQuestion(),poll.isActive(),day,
            participation != null,participation == null ? null : participation.getChoice().getId(),total,choices);
    }
}
