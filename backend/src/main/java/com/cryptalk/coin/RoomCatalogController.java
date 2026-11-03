package com.cryptalk.coin;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "방·카테고리 관리", description = "관리자 방 생성·논리 삭제 및 단일 단계 카테고리 CRUD")
public class RoomCatalogController {
    private final RoomCatalogService service;
    public RoomCatalogController(RoomCatalogService service) { this.service = service; }
    @PostMapping("/admin/communities")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 방 생성")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomCatalogService.RoomResponse create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RoomCatalogService.CreateRoom body) {
        return service.create(actor(jwt), body);
    }
    @PatchMapping("/admin/communities/{symbol}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 방 정보 수정")
    public RoomCatalogService.RoomResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol,
            @Valid @RequestBody RoomCatalogService.UpdateRoom body) { return service.update(actor(jwt), symbol, body); }
    @DeleteMapping("/admin/communities/{symbol}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 방 논리 삭제")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol) { service.delete(actor(jwt), symbol); }
    @GetMapping("/room-categories")
    @io.swagger.v3.oas.annotations.Operation(summary = "공개 방 카테고리 조회")
    public List<RoomCatalogService.CategoryResponse> published() { return service.categories(); }
    @GetMapping("/admin/room-categories")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 방 카테고리 조회")
    public List<RoomCatalogService.CategoryResponse> list(@AuthenticationPrincipal Jwt jwt) { return service.adminCategories(actor(jwt)); }
    @PostMapping("/admin/room-categories")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 방 카테고리 생성")
    @ResponseStatus(HttpStatus.CREATED)
    public RoomCatalogService.CategoryResponse createCategory(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RoomCatalogService.CategoryRequest body) {
        return service.saveCategory(actor(jwt), null, body);
    }
    @PatchMapping("/admin/room-categories/{id}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 방 카테고리 수정")
    public RoomCatalogService.CategoryResponse updateCategory(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id,
            @Valid @RequestBody RoomCatalogService.CategoryRequest body) { return service.saveCategory(actor(jwt), id, body); }
    @DeleteMapping("/admin/room-categories/{id}")
    @io.swagger.v3.oas.annotations.Operation(summary = "관리자 방 카테고리 삭제")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) { service.deleteCategory(actor(jwt), id); }
    private Long actor(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
}
