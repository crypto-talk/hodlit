package com.cryptalk.draw;

import com.cryptalk.common.PageResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "뽑기 이벤트", description = "사용자당 이벤트별 1회 참여 및 관리자 설정")
public class DrawController {
    private final DrawService service;
    public DrawController(DrawService service) { this.service = service; }

    @GetMapping("/draw-events/{id}")
    @io.swagger.v3.oas.annotations.Operation(summary = "공개 이벤트 상세 조회")
    public DrawService.PublicEvent detail(@PathVariable Long id) { return service.detail(id); }

    @GetMapping("/draw-events/{id}/me")
    @io.swagger.v3.oas.annotations.Operation(summary = "내 이벤트 참여 결과 조회")
    public DrawService.Participation me(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { return service.me(actor(jwt), id); }

    @PostMapping("/draw-events/{id}/draw")
    @io.swagger.v3.oas.annotations.Operation(summary = "이벤트 상품 뽑기")
    public DrawService.Result draw(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { return service.draw(actor(jwt), id); }

    @GetMapping("/admin/draw-events")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 이벤트 목록 조회")
    public PageResponse<DrawService.AdminEvent> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(actor(jwt), page, size);
    }

    @GetMapping("/admin/draw-events/{id}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 이벤트 상세 조회")
    public DrawService.AdminEvent adminDetail(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.adminDetail(actor(jwt), id);
    }

    @PostMapping("/admin/draw-events")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 이벤트 초안 생성")
    @ResponseStatus(HttpStatus.CREATED)
    public DrawService.AdminEvent create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DrawService.EventRequest body) {
        return service.save(actor(jwt), null, body);
    }

    @PatchMapping("/admin/draw-events/{id}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 이벤트 초안 수정")
    public DrawService.AdminEvent update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody DrawService.EventRequest body) { return service.save(actor(jwt), id, body); }

    @PutMapping("/admin/draw-events/{id}/prizes")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 이벤트 상품 설정")
    public DrawService.AdminEvent prizes(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody PrizesRequest body) {
        return service.replacePrizes(actor(jwt), id, body.prizes());
    }

    @PatchMapping("/admin/draw-events/{id}/status")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 이벤트 운영 상태 변경")
    public DrawService.AdminEvent status(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id, @Valid @RequestBody StatusRequest body) {
        return service.status(actor(jwt), id, body.status());
    }

    public record PrizesRequest(@NotEmpty @Size(max = 100) List<DrawService.@NotNull @Valid PrizeRequest> prizes) {}
    public record StatusRequest(@NotBlank @Pattern(regexp = "ACTIVE|PAUSED") String status) {}
    private Long actor(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
}
