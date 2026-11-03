package com.cryptalk.banner;

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
@Tag(name = "배너", description = "서비스 관리자 배너 설정 및 공개 조회")
public class BannerController {
    private final BannerService service;
    public BannerController(BannerService service) { this.service = service; }

    @GetMapping("/banners")
    @io.swagger.v3.oas.annotations.Operation(summary = "공개 배너 목록 조회")
    public List<BannerService.PublicBanner> published() { return service.published(); }

    @GetMapping("/admin/banners")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 배너 목록 조회")
    public List<BannerService.BannerResponse> list(@AuthenticationPrincipal Jwt jwt) { return service.list(actor(jwt)); }

    @GetMapping("/admin/banners/{id}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 배너 상세 조회")
    public BannerService.BannerResponse detail(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        return service.detail(actor(jwt), id);
    }

    @PostMapping("/admin/banners")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 배너 등록")
    @ResponseStatus(HttpStatus.CREATED)
    public BannerService.BannerResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody BannerService.SaveRequest body) {
        return service.save(actor(jwt), null, body);
    }

    @PatchMapping("/admin/banners/{id}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 배너 수정")
    public BannerService.BannerResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody BannerService.SaveRequest body) { return service.save(actor(jwt), id, body); }

    @DeleteMapping("/admin/banners/{id}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 배너 삭제")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { service.delete(actor(jwt), id); }

    @PatchMapping("/admin/banners/order")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 배너 순서 변경")
    public List<BannerService.BannerResponse> order(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody OrderRequest body) {
        return service.reorder(actor(jwt), body.ids());
    }
    public record OrderRequest(@NotNull @Size(max = 1000) List<@NotNull @Positive Long> ids) {}
    private Long actor(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
}
