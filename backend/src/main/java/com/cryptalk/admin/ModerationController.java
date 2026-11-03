package com.cryptalk.admin;

import com.cryptalk.common.ApiException;
import com.cryptalk.common.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "서비스 운영 관리", description = "게시글 숨김·복구, 유저 정지·해제, 조치 이력")
public class ModerationController {
    private final ModerationService service;
    private final AdminAccess admins;
    public ModerationController(ModerationService service, AdminAccess admins) { this.service = service; this.admins = admins; }
    @GetMapping("/access")
    @io.swagger.v3.oas.annotations.Operation(summary = "서비스 관리자 권한 확인")
    public Map<String, Boolean> access(@AuthenticationPrincipal Jwt jwt) {
        admins.requireAdmin(actor(jwt));
        return Map.of("admin", true);
    }
    @GetMapping({"/posts", "/members"})
    @io.swagger.v3.oas.annotations.Operation(summary = "관리 대상 목록 조회")
    public PageResponse<Map<String, Object>> list(@AuthenticationPrincipal Jwt jwt, jakarta.servlet.http.HttpServletRequest request,
            @RequestParam(defaultValue = "") String q, @RequestParam(required = false) Boolean state,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(actor(jwt), type(request), q, state, page, size);
    }
    @GetMapping({"/posts/{id}", "/members/{id}"})
    @io.swagger.v3.oas.annotations.Operation(summary = "관리 대상 상세 조회")
    public Map<String, Object> detail(@AuthenticationPrincipal Jwt jwt, jakarta.servlet.http.HttpServletRequest request, @PathVariable Long id) {
        return service.detail(actor(jwt), type(request), id);
    }
    @PatchMapping({"/posts/{id}/status", "/members/{id}/status"})
    @io.swagger.v3.oas.annotations.Operation(summary = "게시글 숨김 또는 계정 정지 변경")
    public Map<String, Object> change(@AuthenticationPrincipal Jwt jwt, jakarta.servlet.http.HttpServletRequest request,
            @PathVariable Long id, @Valid @RequestBody ModerationService.StateRequest body) {
        return service.change(actor(jwt), type(request), id, body);
    }
    @GetMapping("/moderation-logs")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리 조치 이력 조회")
    public PageResponse<Map<String, Object>> logs(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.logs(actor(jwt), page, size);
    }
    private Long actor(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
    private String type(jakarta.servlet.http.HttpServletRequest request) {
        return request.getRequestURI().contains("/admin/posts") ? "posts" : "members";
    }
}
