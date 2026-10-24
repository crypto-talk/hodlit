package com.cryptalk.draft;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/posts/{postId}/draft")
@Tag(name="임시저장", description="로그인 회원 본인의 글 임시저장. 최대 10개, 자동 만료 없음")
public class EditDraftController {
    private final DraftService drafts;
    public EditDraftController(DraftService drafts) { this.drafts = drafts; }

    @Operation(summary="내 글 수정 초안 복원", description="원문 소유자만 조회 가능합니다. 초안이 없으면 404.")
    @GetMapping
    DraftDtos.DraftResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return drafts.editDraft(Long.valueOf(jwt.getSubject()), postId);
    }

    @Operation(summary="내 글 수정 초안 자동저장", description="글당 한 초안을 생성/덮어씁니다. 공개 원문/스냅샷/원문 미디어는 변경하지 않습니다.")
    @PutMapping
    DraftDtos.DraftResponse save(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId,
            @Valid @RequestBody DraftDtos.SaveDraftRequest request) {
        return drafts.saveEditDraft(Long.valueOf(jwt.getSubject()), postId, request);
    }
}
