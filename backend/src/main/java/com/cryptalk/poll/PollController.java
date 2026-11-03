package com.cryptalk.poll;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import com.cryptalk.common.PageResponse;
import java.time.LocalDate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Tag(name="방 투표",description="운영자 생성·KST 당일 단일 참여·참여 후 결과 공개")
public class PollController {
    private final PollService polls;
    public PollController(PollService polls) { this.polls = polls; }

    @Operation(summary="방 현재 투표 조회",description="미참여자/익명에게 집계값을 반환하지 않습니다.")
    @GetMapping("/communities/{symbol}/poll")
    PollDtos.PollResponse current(@PathVariable String symbol,@AuthenticationPrincipal Jwt jwt) {
        return polls.current(symbol,member(jwt));
    }

    @Operation(summary="투표 조회",description="진행 중인 오늘 결과는 참여자만, 종료된 투표의 오늘 결과는 공개합니다.")
    @GetMapping("/polls/{pollId}")
    PollDtos.PollResponse get(@PathVariable Long pollId,@AuthenticationPrincipal Jwt jwt) {
        return polls.get(pollId,member(jwt));
    }

    @Operation(summary="방 지난 투표 결과",description="KST 어제까지와 종료된 투표의 오늘 집계를 날짜·투표별로 조회합니다.")
    @GetMapping("/communities/{symbol}/polls/results")
    PageResponse<PollDtos.DailyResult> roomResults(@PathVariable String symbol,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return polls.roomResults(symbol,page,size);
    }

    @Operation(summary="투표 날짜별 결과",description="from/to는 KST 날짜(양 끝 포함). 진행 중인 오늘은 참여자만 조회 가능합니다.")
    @GetMapping("/polls/{pollId}/results")
    PageResponse<PollDtos.DailyResult> results(@PathVariable Long pollId,@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return polls.results(pollId,member(jwt),from,to,page,size);
    }

    @Operation(summary="내 투표 기록",description="인증된 본인의 선택·투표 시각·그날의 집계를 조회합니다. 가격·수량 구간은 비공개입니다.")
    @GetMapping("/me/votes")
    PageResponse<PollDtos.VoteHistory> myVotes(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
        return polls.myVotes(member(jwt),page,size);
    }

    @Operation(summary="운영자 방 투표 생성",description="새 질문 생성 시 기존 활성 질문은 종료하고 기록은 유지합니다.")
    @PostMapping("/communities/{symbol}/polls")
    ResponseEntity<PollDtos.PollResponse> create(@PathVariable String symbol,@AuthenticationPrincipal Jwt jwt,
                                                @Valid @RequestBody PollDtos.CreatePollRequest request) {
        return ResponseEntity.status(201).body(polls.create(member(jwt),symbol,request));
    }

    @Operation(summary="오늘 투표 참여",description="사용자·투표·KST 날짜별 한 번, 변경 불가. 다음 날 다시 참여 가능합니다.")
    @PostMapping("/polls/{pollId}/votes")
    PollDtos.PollResponse vote(@PathVariable Long pollId,@AuthenticationPrincipal Jwt jwt,
                               @Valid @RequestBody PollDtos.VoteRequest request) {
        return polls.vote(member(jwt),pollId,request.choiceId());
    }

    @Operation(summary="운영자 투표 종료",description="기록 삭제 없이 추가 참여를 차단합니다. 자정에 자동 종료되지 않습니다.")
    @PostMapping("/polls/{pollId}/close")
    ResponseEntity<Void> close(@PathVariable Long pollId,@AuthenticationPrincipal Jwt jwt) {
        polls.close(member(jwt),pollId);
        return ResponseEntity.noContent().build();
    }

    private Long member(Jwt jwt) { return jwt == null ? null : Long.valueOf(jwt.getSubject()); }
}
