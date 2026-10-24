package com.cryptalk.draft;

import com.cryptalk.draft.DraftDtos.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/drafts")
@Tag(name = "임시저장", description = "로그인 회원 본인의 글 임시저장. 최대 10개, 자동 만료 없음")
public class DraftController {
    private final DraftService drafts;
    public DraftController(DraftService drafts) { this.drafts = drafts; }

    @Operation(summary = "내 임시저장 목록", description = "최근 수정순으로 전체 목록을 반환합니다.")
    @GetMapping
    List<DraftResponse> list(@AuthenticationPrincipal Jwt jwt) { return drafts.list(id(jwt)); }

    @Operation(summary = "내 임시저장 상세")
    @GetMapping("/{draftId}")
    DraftResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long draftId) { return drafts.get(id(jwt), draftId); }

    @Operation(summary = "임시저장 생성", description = "빈 필드를 허용합니다. 지갑·시세 조회나 스냅샷 기록을 수행하지 않습니다.")
    @PostMapping
    ResponseEntity<DraftResponse> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SaveDraftRequest request) {
        return ResponseEntity.status(201).body(drafts.create(id(jwt), request));
    }

    @Operation(summary = "임시저장 덮어쓰기", description = "전체 교체입니다. 생략한 필드는 null로 저장합니다.")
    @PutMapping("/{draftId}")
    DraftResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long draftId,
                         @Valid @RequestBody SaveDraftRequest request) { return drafts.update(id(jwt), draftId, request); }

    @Operation(summary = "임시저장 삭제", description = "발행 성공 후 프론트에서 호출합니다. 발행된 미디어는 보존됩니다.")
    @DeleteMapping("/{draftId}")
    ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long draftId) {
        drafts.delete(id(jwt), draftId);
        return ResponseEntity.noContent().build();
    }
    private Long id(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
}
