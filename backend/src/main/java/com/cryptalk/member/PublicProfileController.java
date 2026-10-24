package com.cryptalk.member;

import com.cryptalk.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/members")
@Tag(name = "공개 프로필", description = "비로그인 조회 가능. 지갑 주소와 정확 수량은 공개하지 않습니다.")
public class PublicProfileController {
    private final PublicProfileService profiles;

    public PublicProfileController(PublicProfileService profiles) { this.profiles = profiles; }

    @Operation(summary = "닉네임으로 공개 프로필 조회", description = "현재 닉네임으로 조회합니다. 공개 글·댓글 수와 마지막 저장 시점의 공개 자산 구간을 반환합니다.")
    @GetMapping("/by-nickname/{nickname}")
    PublicProfileDtos.ProfileResponse profile(@PathVariable String nickname) {
        return profiles.byNickname(nickname);
    }

    @Operation(summary = "회원이 작성한 공개 글 페이지", description = "최신순. 운영 중인 방의 글만 조회하며 작성 당시 보유 기록을 제공합니다. page=0, size=20 기본, size 최대 100.")
    @GetMapping("/{memberId}/posts/page")
    PageResponse<PublicProfileDtos.PostResponse> posts(@PathVariable Long memberId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return profiles.posts(memberId, page, size);
    }

    @Operation(summary = "회원이 작성한 공개 댓글 페이지", description = "최신순. 운영 중인 방의 댓글·답글만 조회합니다. 댓글 보유 기록은 수량 구간을 공개하지 않습니다. page=0, size=20 기본, size 최대 100.")
    @GetMapping("/{memberId}/comments/page")
    PageResponse<PublicProfileDtos.CommentResponse> comments(@PathVariable Long memberId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return profiles.comments(memberId, page, size);
    }
}
