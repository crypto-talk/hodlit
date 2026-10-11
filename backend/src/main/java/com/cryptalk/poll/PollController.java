package com.cryptalk.poll;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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

    @Operation(summary="투표 조회",description="결과는 해당 KST 날짜에 참여한 사용자만 볼 수 있습니다.")
    @GetMapping("/polls/{pollId}")
    PollDtos.PollResponse get(@PathVariable Long pollId,@AuthenticationPrincipal Jwt jwt) {
        return polls.get(pollId,member(jwt));
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
