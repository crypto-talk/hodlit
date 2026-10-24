package com.cryptalk.media;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/media")
@Tag(name = "미디어", description = "게시글 이미지·영상 업로드, 조회 및 삭제 API")
public class MediaController {
    private final MediaService media;

    public MediaController(MediaService media) { this.media = media; }

    @Operation(summary = "미디어 업로드", description = "로그인 회원이 게시글에 사용할 이미지 또는 영상을 업로드합니다.")
    @PostMapping
    MediaService.StoredMedia upload(@AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) {
        return media.store(id(jwt), file);
    }

    @Operation(summary = "미디어 파일 조회")
    @GetMapping("/{fileName}")
    ResponseEntity<Resource> get(@PathVariable String fileName) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(media.contentType(fileName)))
            .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
            .body(media.load(fileName));
    }

    @Operation(summary = "미디어 파일 삭제", description = "업로드한 회원이 아직 게시글에 연결되지 않은 파일을 삭제합니다.")
    @DeleteMapping("/{fileName}")
    ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable String fileName) {
        media.delete(id(jwt), fileName); return ResponseEntity.noContent().build();
    }

    private Long id(Jwt jwt) { return Long.valueOf(jwt.getSubject()); }
}
