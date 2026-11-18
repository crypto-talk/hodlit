package com.cryptalk.banner;

import com.cryptalk.admin.AdminAccess;
import com.cryptalk.common.ApiException;
import com.cryptalk.media.MediaAssetRepository;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BannerService {
    private final BannerRepository banners;
    private final MediaAssetRepository media;
    private final AdminAccess admins;

    public BannerService(BannerRepository banners, MediaAssetRepository media, AdminAccess admins) {
        this.banners = banners;
        this.media = media;
        this.admins = admins;
    }

    @Transactional(readOnly = true)
    public List<PublicBanner> published() {
        return banners.findByVisibleTrueOrderByDisplayOrderAscIdAsc().stream()
            .map(b -> new PublicBanner(b.getId(), b.getImageUrl(), b.getAltText(), b.getLinkUrl(), b.getDisplayOrder())).toList();
    }

    @Transactional(readOnly = true)
    public List<BannerResponse> list(Long actor) {
        admins.requireAdmin(actor);
        return banners.findAllByOrderByDisplayOrderAscIdAsc().stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public BannerResponse detail(Long actor, Long id) {
        admins.requireAdmin(actor);
        return response(find(id));
    }

    @Transactional
    public BannerResponse save(Long actor, Long id, SaveRequest request) {
        admins.requireAdmin(actor);
        validateLink(request.linkUrl());
        validateImage(actor, request.imageUrl());
        Banner banner;
        if (id == null) banner = banners.save(new Banner(request));
        else {
            banner = find(id);
            banner.update(request);
        }
        return response(banner);
    }

    @Transactional
    public void delete(Long actor, Long id) {
        admins.requireAdmin(actor);
        banners.delete(find(id)); // Images may be referenced elsewhere; never delete files here.
    }

    @Transactional
    public List<BannerResponse> reorder(Long actor, List<Long> ids) {
        admins.requireAdmin(actor);
        if (new HashSet<>(ids).size() != ids.size()) throw bad("배너 ID가 중복되었습니다.");
        var all = banners.findAllByOrderByDisplayOrderAscIdAsc();
        if (!new HashSet<>(all.stream().map(Banner::getId).toList()).equals(new HashSet<>(ids)))
            throw bad("모든 배너 ID를 한 번씩 전달해 주세요.");
        var byId = all.stream().collect(java.util.stream.Collectors.toMap(Banner::getId, b -> b));
        for (int i = 0; i < ids.size(); i++) byId.get(ids.get(i)).reorder(i);
        banners.flush();
        return list(actor);
    }

    private Banner find(Long id) {
        return banners.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "배너를 찾을 수 없습니다."));
    }

    private void validateImage(Long actor, String url) {
        if (url == null || !url.matches("/api/v1/media/[0-9a-f-]{36}\\.(jpg|png|webp|gif)"))
            throw bad("이미지는 기존 미디어 API로 업로드한 이미지여야 합니다.");
        var asset = media.lockByFileName(url.substring("/api/v1/media/".length()))
            .orElseThrow(() -> bad("이미지 업로드 기록이 없습니다."));
        if (!asset.getMember().getId().equals(actor)) throw new ApiException(HttpStatus.FORBIDDEN, "본인이 업로드한 이미지만 설정할 수 있습니다.");
        if (asset.getPost() != null || asset.getDraftId() != null) throw bad("게시글·임시저장에 연결된 이미지는 사용할 수 없습니다.");
    }

    public static void validateLink(String link) {
        if (link == null || link.isEmpty()) return;
        try {
            if (link.chars().anyMatch(c -> c <= 32 || c == 127) || link.contains("\\")) throw new IllegalArgumentException();
            URI uri = URI.create(link);
            if (link.startsWith("/") && !link.startsWith("//") && uri.getRawAuthority() == null) return;
            if (("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null) return;
        } catch (IllegalArgumentException ignored) { }
        throw bad("링크는 내부 경로 또는 HTTP/HTTPS URL이어야 합니다.");
    }

    private static ApiException bad(String message) { return new ApiException(HttpStatus.BAD_REQUEST, message); }
    private BannerResponse response(Banner b) {
        return new BannerResponse(b.getId(), b.getTitle(), b.getImageUrl(), b.getAltText(), b.getLinkUrl(),
            b.isVisible(), b.getDisplayOrder(), b.getCreatedAt(), b.getUpdatedAt());
    }

    @io.swagger.v3.oas.annotations.media.Schema(name = "SaveBannerRequest")
    public record SaveRequest(@NotBlank @Size(max = 100) String title,
            @NotBlank @Size(max = 1000) String imageUrl, @NotBlank @Size(max = 200) String altText,
            @Size(max = 1000) String linkUrl, @NotNull Boolean visible, @NotNull @Min(0) Integer displayOrder) {}
    public record BannerResponse(Long id, String title, String imageUrl, String altText, String linkUrl,
            boolean visible, int displayOrder, Instant createdAt, Instant updatedAt) {}
    public record PublicBanner(Long id, String imageUrl, String altText, String linkUrl, int displayOrder) {}
}
