package com.cryptalk.poll;

import com.cryptalk.coin.RoomAccess;
import com.cryptalk.admin.AdminAccess;
import com.cryptalk.coin.CoinRepository;
import com.cryptalk.common.ApiException;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.asset.AssetService;
import com.cryptalk.market.MarketPriceService;
import com.cryptalk.market.MarketPriceService.PriceQuote;
import com.cryptalk.common.PageResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

@Service
public class PollService {
    private final RoomAccess rooms;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final PollRepository polls;
    private final PollVoteRepository votes;
    private final CoinRepository coins;
    private final MemberRepository members;
    private final AdminAccess admins;
    private final Clock clock;
    private final AssetService assets;
    private final MarketPriceService prices;

    public PollService(PollRepository polls,PollVoteRepository votes,CoinRepository coins,MemberRepository members,
                       AdminAccess admins,@Qualifier("pollClock") Clock clock, RoomAccess rooms,
                       AssetService assets, MarketPriceService prices) {
        this.rooms = rooms;
        this.polls = polls;
        this.votes = votes;
        this.coins = coins;
        this.members = members;
        this.admins = admins;
        this.clock = clock;
        this.assets = assets;
        this.prices = prices;
    }

    @Transactional
    public PollDtos.PollResponse create(Long memberId,String symbol,PollDtos.CreatePollRequest request) {
        admins.requireAdmin(memberId);
        if (request.choices().stream().map(value -> value.strip().toLowerCase(Locale.ROOT)).distinct().count() != request.choices().size())
            throw new ApiException(HttpStatus.BAD_REQUEST,"중복 선택지는 허용하지 않습니다.");
        var coin = coins.lockActiveBySymbol(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"코인 방을 찾을 수 없습니다."));
        rooms.requireCoinFeatures(coin);
        polls.findByCoinIdAndActiveTrue(coin.getId()).forEach(CommunityPoll::close);
        var poll = polls.saveAndFlush(new CommunityPoll(coin,request.question(),request.choices()));
        return response(poll,memberId,today());
    }

    @Transactional(readOnly=true)
    public PollDtos.PollResponse current(String symbol,Long memberId) {
        var coin = coins.findBySymbolIgnoreCaseAndActiveTrue(symbol)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"코인 방을 찾을 수 없습니다."));
        rooms.requireOpen(coin);
        if (coin.isGeneralRoom()) throw new ApiException(HttpStatus.NOT_FOUND,"현재 투표가 없습니다.");
        var poll = polls.findFirstByCoinIdAndActiveTrueOrderByCreatedAtDescIdDesc(coin.getId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"현재 투표가 없습니다."));
        return response(poll,memberId,today());
    }

    @Transactional(readOnly=true)
    public PollDtos.PollResponse get(Long pollId,Long memberId) {
        var poll = polls.findById(pollId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"투표를 찾을 수 없습니다."));
        rooms.requireOpen(poll.getCoin());
        rooms.requireCoinFeatures(poll.getCoin());
        return response(poll,memberId,today());
    }

    @Transactional(isolation=Isolation.READ_COMMITTED)
    public PollDtos.PollResponse vote(Long memberId,Long pollId,Long choiceId) {
        var member = members.lockById(memberId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다."));
        var poll = polls.lockById(pollId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"투표를 찾을 수 없습니다."));
        rooms.requireOpen(poll.getCoin());
        rooms.requireCoinFeatures(poll.getCoin());
        if (!poll.isActive() || !poll.getCoin().isActive()) throw new ApiException(HttpStatus.CONFLICT,"종료된 투표입니다.");
        var choice = poll.getChoices().stream().filter(item -> item.getId().equals(choiceId)).findFirst()
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST,"해당 투표의 선택지가 아닙니다."));
        requireNotVoted(pollId,memberId,today());
        var asset = assets.snapshotForPublication(memberId,poll.getCoin());
        PriceQuote quote = null;
        try {
            quote = prices.currentPrice(poll.getCoin(),"USD");
        } catch (ApiException exception) {
            if (exception.status() != HttpStatus.SERVICE_UNAVAILABLE
                    && exception.status() != HttpStatus.UNPROCESSABLE_ENTITY) throw exception;
        }
        // External refresh may cross midnight. Use one final instant for the vote and its KST day.
        Instant votedAt = clock.instant();
        LocalDate day = LocalDate.ofInstant(votedAt,SEOUL);
        requireNotVoted(pollId,memberId,day);
        var vote = new PollVote(poll,member,choice,day);
        vote.capture(votedAt,quote,asset);
        votes.saveAndFlush(vote);
        return response(poll,memberId,day);
    }

    private void requireNotVoted(Long pollId,Long memberId,LocalDate day) {
        if (votes.findByPollIdAndMemberIdAndVoteDate(pollId,memberId,day).isPresent())
            throw new ApiException(HttpStatus.CONFLICT,"오늘 이미 참여했습니다. 선택 변경은 불가능합니다.");
    }

    @Transactional(readOnly=true)
    public PageResponse<PollDtos.DailyResult> roomResults(String symbol,int page,int size) {
        var request = PageResponse.request(page,size,Sort.unsorted());
        var coin = rooms.requireOpen(symbol);
        if (coin.isGeneralRoom()) return PageResponse.of(Page.empty(request));
        return PageResponse.of(votes.roomResultDays(coin.getId(),today(),request).map(row ->
            dailyResult(polls.findById(row.getPollId()).orElseThrow(),row.getVoteDay())));
    }

    @Transactional(readOnly=true)
    public PageResponse<PollDtos.DailyResult> results(Long pollId,Long memberId,LocalDate from,LocalDate to,int page,int size) {
        var request = PageResponse.request(page,size,Sort.unsorted());
        var poll = polls.findById(pollId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"투표를 찾을 수 없습니다."));
        rooms.requireOpen(poll.getCoin());
        rooms.requireCoinFeatures(poll.getCoin());
        LocalDate today = today();
        LocalDate start = from == null ? LocalDate.of(1970,1,1) : from;
        LocalDate end = to == null ? (poll.isActive() ? today.minusDays(1) : today) : to;
        if (end.isAfter(today) || start.isAfter(end))
            throw new ApiException(HttpStatus.BAD_REQUEST,"조회 날짜 범위를 확인해 주세요.");
        if (poll.isActive() && end.equals(today)
                && (memberId == null || votes.findByPollIdAndMemberIdAndVoteDate(pollId,memberId,today).isEmpty()))
            throw new ApiException(HttpStatus.FORBIDDEN,"오늘 결과는 참여 후 확인할 수 있습니다.");
        return PageResponse.of(votes.resultDays(pollId,start,end,request).map(day -> dailyResult(poll,day)));
    }

    @Transactional(readOnly=true)
    public PageResponse<PollDtos.VoteHistory> myVotes(Long memberId,int page,int size) {
        if (memberId == null) throw new ApiException(HttpStatus.UNAUTHORIZED,"로그인이 필요합니다.");
        var request = PageResponse.request(page,size,Sort.by(Sort.Direction.DESC,"voteDate","id"));
        if (!members.existsById(memberId)) throw new ApiException(HttpStatus.NOT_FOUND,"회원을 찾을 수 없습니다.");
        return PageResponse.of(votes.findByMemberId(memberId,request).map(vote -> new PollDtos.VoteHistory(
            vote.getId(),vote.getVoteDate(),vote.getVotedAt(),vote.getChoice().getId(),vote.getChoice().getLabel(),
            dailyResult(vote.getPoll(),vote.getVoteDate()))));
    }

    private PollDtos.DailyResult dailyResult(CommunityPoll poll,LocalDate day) {
        Map<Long,Long> counts = new HashMap<>();
        votes.counts(poll.getId(),day).forEach(row -> counts.put(row.getChoiceId(),row.getVotes()));
        Map<String,Map<Long,Long>> groups = new TreeMap<>();
        votes.holderCounts(poll.getId(),day).forEach(row -> groups
            .computeIfAbsent(row.getHolderStatus(),key -> new HashMap<>()).put(row.getChoiceId(),row.getVotes()));
        var holders = groups.entrySet().stream().map(group -> new PollDtos.HolderResult(group.getKey(),
            group.getValue().values().stream().mapToLong(Long::longValue).sum(),poll.getChoices().stream()
                .map(c -> new PollDtos.ChoiceResponse(c.getId(),c.getLabel(),group.getValue().getOrDefault(c.getId(),0L))).toList())).toList();
        return new PollDtos.DailyResult(poll.getId(),poll.getCoin().getSymbol(),poll.getQuestion(),poll.isActive(),day,
            counts.values().stream().mapToLong(Long::longValue).sum(),poll.getChoices().stream()
                .map(c -> new PollDtos.ChoiceResponse(c.getId(),c.getLabel(),counts.getOrDefault(c.getId(),0L))).toList(),holders);
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
        boolean visible = participation != null || !poll.isActive();
        if (visible) {
            votes.counts(poll.getId(),day).forEach(row -> counts.put(row.getChoiceId(),row.getVotes()));
            total = counts.values().stream().mapToLong(Long::longValue).sum();
        }
        var choices = poll.getChoices().stream().map(item -> new PollDtos.ChoiceResponse(item.getId(),item.getLabel(),
            visible ? counts.getOrDefault(item.getId(),0L) : null)).toList();
        return new PollDtos.PollResponse(poll.getId(),poll.getCoin().getSymbol(),poll.getQuestion(),poll.isActive(),day,
            participation != null,participation == null ? null : participation.getChoice().getId(),total,choices);
    }
}
