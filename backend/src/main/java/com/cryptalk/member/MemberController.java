package com.cryptalk.member;

import com.cryptalk.asset.AssetService;
import com.cryptalk.auth.AuthDtos.MemberResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "내 정보·자산", description = "로그인 회원의 프로필, 자산 및 공개 설정 API")
public class MemberController {
    private final MemberService members; private final AssetService assets;
    public MemberController(MemberService members, AssetService assets) { this.members = members; this.assets = assets; }
    @Operation(summary = "내 프로필 조회")
    @GetMapping MemberResponse me(@AuthenticationPrincipal Jwt jwt) { return members.get(id(jwt)); }
    @Operation(summary = "내 프로필 수정", description = "닉네임과 아바타 색상을 변경합니다.")
    @PatchMapping MemberResponse update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateMemberRequest request) { return members.update(id(jwt), request.nickname(), request.avatarColor()); }
    @Operation(summary = "내 자산 조회 및 갱신", description = "지갑·거래소 합산 자산을 갱신합니다. Alchemy 설정 시 walletAssets에 지갑의 기본 자산 및 ERC20 목록도 반환합니다.")
    @GetMapping("/assets") AssetService.AssetPortfolioResponse assets(@AuthenticationPrincipal Jwt jwt) { return assets.refreshPortfolio(id(jwt)); }
    @Operation(summary = "내 지갑 자산 목록 조회", description = "거래소 조회 없이 연결된 지갑의 Ethereum·Polygon 기본 자산 및 ERC20 토큰을 Alchemy로 조회합니다. API 키 설정이 필요합니다.")
    @GetMapping("/wallets/assets") com.cryptalk.asset.AlchemyPortfolioClient.Result walletAssets(@AuthenticationPrincipal Jwt jwt) { return assets.walletPortfolio(id(jwt)); }
    @Operation(summary = "자산 공개 범위 변경")
    @PatchMapping("/asset-visibility") MemberResponse visibility(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody VisibilityRequest request) { return members.visibility(id(jwt), request.visibility()); }
    private Long id(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
    public record UpdateMemberRequest(@Size(min=2,max=40) String nickname, @Pattern(regexp="^#[0-9a-fA-F]{6}$") String avatarColor) {}
    public record VisibilityRequest(@NotNull AssetVisibility visibility) {}
}
