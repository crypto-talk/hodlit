package com.cryptalk.coin;

import com.cryptalk.common.PageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/communities")
@Tag(name = "서비스 관리자 방 관리", description = "서비스 전체 관리자 전용 방 운영 상태 관리")
public class RoomAdminController {
    private final RoomAdminService rooms;

    public RoomAdminController(RoomAdminService rooms) { this.rooms = rooms; }

    @GetMapping
    @Operation(summary = "관리자 방 목록 조회", description = "이름·심볼 검색(q), OPEN/CLOSE 필터(operationStatus), 번호 페이지를 지원합니다.")
    public PageResponse<RoomAdminService.RoomResponse> list(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "") String q, @RequestParam(required = false) String operationStatus,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return rooms.list(Long.valueOf(jwt.getSubject()), q, operationStatus, page, size);
    }

    @PatchMapping("/{symbol}/status")
    @Operation(summary = "방 운영 상태 변경", description = "OPEN은 정상 이용, CLOSE는 ROOM_CLOSED 오류로 콘텐츠 접근·참여를 차단합니다. 데이터는 보존합니다.")
    public RoomAdminService.RoomResponse changeStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable String symbol,
            @Valid @RequestBody ChangeStatusRequest request) {
        return rooms.changeStatus(Long.valueOf(jwt.getSubject()), symbol, request.operationStatus());
    }

    public record ChangeStatusRequest(@NotBlank @Pattern(regexp = "OPEN|CLOSE") String operationStatus) {}
}
