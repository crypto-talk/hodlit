package com.cryptalk.member;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me/asset-visibility")
@Tag(name = "공개 프로필 자산 설정", description = "코인별 공개 여부. 회원 전체 HIDDEN 설정이 우선합니다.")
public class AssetPublicationController {
    private final AssetPublicationService service;
    public AssetPublicationController(AssetPublicationService service) { this.service = service; }
    @GetMapping
    @io.swagger.v3.oas.annotations.Operation(summary = "내 공개 프로필 코인별 공개 설정 조회")
    public List<AssetPublicationService.Preference> list(@AuthenticationPrincipal Jwt jwt) { return service.list(Long.valueOf(jwt.getSubject())); }
    @PutMapping("/{symbol}")
    @io.swagger.v3.oas.annotations.Operation(summary = "내 공개 프로필 코인별 공개 설정 변경")
    public AssetPublicationService.Preference save(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol, @Valid @RequestBody VisibilityRequest body) {
        return service.save(Long.valueOf(jwt.getSubject()), symbol, body.visible());
    }
    @io.swagger.v3.oas.annotations.media.Schema(name = "UpdateProfileCoinVisibilityRequest")
    public record VisibilityRequest(@NotNull Boolean visible) {}
}
