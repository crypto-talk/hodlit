package com.cryptalk.badge;

import com.cryptalk.admin.AdminAccess;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "관리자 등급 배지", description = "방별 수량 경계 및 디자인 프리셋 설정. 새 글·댓글부터 적용")
public class BadgeController {
    private final BadgeService badges;
    private final AdminAccess admins;
    public BadgeController(BadgeService badges, AdminAccess admins) { this.badges = badges; this.admins = admins; }
    @GetMapping("/badge-presets")
    @io.swagger.v3.oas.annotations.Operation(summary = "등급 배지 디자인 프리셋 조회")
    public BadgeService.Presets presets(@AuthenticationPrincipal Jwt jwt) {
        admins.requireAdmin(Long.valueOf(jwt.getSubject()));
        return new BadgeService.Presets(BadgeService.ICONS, BadgeService.COLORS, BadgeService.EFFECTS);
    }
    @GetMapping("/communities/{symbol}/badge-config")
    @io.swagger.v3.oas.annotations.Operation(summary = "방별 등급 설정 조회")
    public BadgeService.Config get(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol) {
        return badges.get(Long.valueOf(jwt.getSubject()), symbol);
    }
    @PutMapping("/communities/{symbol}/badge-config")
    @io.swagger.v3.oas.annotations.Operation(summary = "방별 등급 설정 저장")
    public BadgeService.Config save(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol,
            @Valid @RequestBody BadgeService.SaveRequest request) {
        return badges.save(Long.valueOf(jwt.getSubject()), symbol, request);
    }
}
