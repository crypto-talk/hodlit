package com.cryptalk.social;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/members/{memberId}")
@Tag(name = "팔로우", description = "회원 팔로우 관계와 팔로워·팔로잉 목록 API")
public class FollowController {
    private final FollowService follows;
    public FollowController(FollowService follows) { this.follows = follows; }

    @Operation(summary = "회원 팔로우")
    @PostMapping("/follow") FollowService.FollowStats follow(@AuthenticationPrincipal Jwt jwt, @PathVariable Long memberId) { return follows.follow(id(jwt), memberId); }
    @Operation(summary = "회원 팔로우 취소")
    @DeleteMapping("/follow") FollowService.FollowStats unfollow(@AuthenticationPrincipal Jwt jwt, @PathVariable Long memberId) { return follows.unfollow(id(jwt), memberId); }
    @Operation(summary = "회원 팔로우 통계 조회", description = "팔로워·팔로잉 수와 로그인 회원의 팔로우 여부를 반환합니다.")
    @GetMapping("/social") FollowService.FollowStats stats(@AuthenticationPrincipal Jwt jwt, @PathVariable Long memberId) { return follows.stats(jwt == null ? null : id(jwt), memberId); }
    @Operation(summary = "회원 팔로워 목록 조회")
    @GetMapping("/followers") List<FollowService.MemberSummary> followers(@PathVariable Long memberId) { return follows.followers(memberId); }
    @Operation(summary = "회원 팔로잉 목록 조회")
    @GetMapping("/following") List<FollowService.MemberSummary> following(@PathVariable Long memberId) { return follows.following(memberId); }
    private Long id(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
}
