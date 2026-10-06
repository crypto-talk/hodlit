package com.cryptalk.media;

import com.cryptalk.common.ApiException;
import com.cryptalk.member.Member;
import com.cryptalk.member.MemberRepository;
import com.cryptalk.post.Post;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaService {
    private static final long MAX_BYTES = 25L * 1024 * 1024;
    private static final Map<String, String> EXTENSIONS = Map.of(
        "image/jpeg", "jpg",
        "image/png", "png",
        "image/webp", "webp",
        "image/gif", "gif",
        "video/mp4", "mp4",
        "video/webm", "webm",
        "video/quicktime", "mov"
    );

    private final Path root;
    private final MediaAssetRepository assets;
    private final MemberRepository members;

    public MediaService(@Value("${cryptalk.media.storage-path}") String storagePath,
                        MediaAssetRepository assets, MemberRepository members) {
        this.root = Path.of(storagePath).toAbsolutePath().normalize();
        this.assets = assets; this.members = members;
    }

    @PostConstruct
    void initialize() {
        try {
            Files.createDirectories(root);
        } catch (IOException exception) {
            throw new IllegalStateException("미디어 저장소를 초기화할 수 없습니다.", exception);
        }
    }

    @Transactional
    public StoredMedia store(Long memberId, MultipartFile file) {
        Member member = members.findById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        if (file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "빈 파일은 업로드할 수 없습니다.");
        if (file.getSize() > MAX_BYTES) throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "파일은 25MB 이하여야 합니다.");
        String contentType = file.getContentType();
        String extension = EXTENSIONS.get(contentType);
        if (extension == null) throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "지원하지 않는 이미지 또는 영상 형식입니다.");

        String fileName = UUID.randomUUID() + "." + extension;
        Path target = root.resolve(fileName).normalize();
        if (!target.getParent().equals(root)) throw new ApiException(HttpStatus.BAD_REQUEST, "잘못된 파일 이름입니다.");
        try {
            Files.copy(file.getInputStream(), target);
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "파일을 저장하지 못했습니다.");
        }
        String mediaType = contentType.startsWith("image/") ? "IMAGE" : "VIDEO";
        assets.save(new MediaAsset(fileName, member, mediaType, contentType, file.getSize()));
        deleteOnRollback(fileName);
        return new StoredMedia(mediaType, "/api/v1/media/" + fileName, contentType, file.getSize());
    }

    @Transactional
    public void delete(Long memberId, String fileName) {
        MediaAsset asset = assets.lockByFileName(fileName)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "미디어를 찾을 수 없습니다."));
        if (!asset.getMember().getId().equals(memberId))
            throw new ApiException(HttpStatus.FORBIDDEN, "업로드한 사용자만 미디어를 삭제할 수 있습니다.");
        if (asset.getPost() != null)
            throw new ApiException(HttpStatus.CONFLICT, "게시글에 연결된 미디어는 게시글 수정 또는 삭제로 제거해 주세요.");
        if (asset.getDraftId() != null)
            throw new ApiException(HttpStatus.CONFLICT, "임시저장에 연결된 미디어는 임시저장 수정 또는 삭제로 해제해 주세요.");
        assets.delete(asset);
        deleteAfterCommit(Set.of(fileName));
    }

    public void claim(Long memberId, Post post, String url, boolean allowLegacyMissing) {
        String fileName = managedFileName(url);
        if (fileName == null) return;
        MediaAsset asset = assets.lockByFileName(fileName).orElse(null);
        if (asset == null && allowLegacyMissing) return;
        if (asset == null) throw new ApiException(HttpStatus.BAD_REQUEST, "업로드 기록이 없는 미디어 URL입니다.");
        if (!asset.getMember().getId().equals(memberId))
            throw new ApiException(HttpStatus.FORBIDDEN, "본인이 업로드한 미디어만 게시할 수 있습니다.");
        if (asset.getPost() != null && !asset.getPost().getId().equals(post.getId()))
            throw new ApiException(HttpStatus.CONFLICT, "이미 다른 게시글에 연결된 미디어입니다.");
        asset.attach(post);
    }

    public void deleteManagedAfterCommit(Collection<String> urls) {
        Set<String> fileNames = new LinkedHashSet<>();
        for (String url : urls) {
            String fileName = managedFileName(url);
            if (fileName != null) fileNames.add(fileName);
        }
        if (fileNames.isEmpty()) return;
        // Lock before checking protection so draft saves and deletion cannot race.
        for (String fileName : new java.util.TreeSet<>(fileNames)) {
            MediaAsset asset = assets.lockByFileName(fileName).orElse(null);
            if (asset != null && asset.getDraftId() != null) {
                fileNames.remove(fileName);
            } else if (asset != null) {
                // Entity deletion keeps Hibernate's context consistent when the post is deleted next.
                assets.delete(asset);
            }
        }
        if (fileNames.isEmpty()) return;
        deleteAfterCommit(fileNames);
    }

    public void replaceDraftMedia(Long memberId, Long draftId, Collection<String> urls) {
        Set<String> retained = new java.util.TreeSet<>();
        for (String url : urls) {
            String fileName = managedFileName(url);
            if (url.startsWith("/api/v1/media/")) {
                if (fileName == null)
                    throw new ApiException(HttpStatus.BAD_REQUEST, "잘못된 업로드 URL입니다.");
                retained.add(fileName);
            } else {
                try {
                    java.net.URI uri = java.net.URI.create(url);
                    if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                        throw new IllegalArgumentException();
                } catch (IllegalArgumentException exception) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "미디어 URL은 업로드 URL 또는 HTTPS URL이어야 합니다.");
                }
            }
        }
        for (MediaAsset asset : assets.findByDraftIdOrderByFileName(draftId)) {
            if (!retained.contains(asset.getFileName())) asset.attachDraft(null);
        }
        for (String fileName : retained) {
            MediaAsset asset = assets.lockByFileName(fileName)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "업로드 기록이 없는 미디어 URL입니다."));
            if (!asset.getMember().getId().equals(memberId))
                throw new ApiException(HttpStatus.FORBIDDEN, "본인이 업로드한 미디어만 임시저장할 수 있습니다.");
            if (asset.getPost() != null || (asset.getDraftId() != null && !asset.getDraftId().equals(draftId)))
                throw new ApiException(HttpStatus.CONFLICT, "이미 다른 글에 연결된 미디어입니다.");
            asset.attachDraft(draftId);
        }
    }

    public Resource load(String fileName) {
        if (!validFileName(fileName))
            throw new ApiException(HttpStatus.NOT_FOUND, "미디어를 찾을 수 없습니다.");
        Path target = root.resolve(fileName).normalize();
        if (!target.getParent().equals(root) || !Files.isRegularFile(target))
            throw new ApiException(HttpStatus.NOT_FOUND, "미디어를 찾을 수 없습니다.");
        try {
            return new UrlResource(target.toUri());
        } catch (MalformedURLException exception) {
            throw new ApiException(HttpStatus.NOT_FOUND, "미디어를 찾을 수 없습니다.");
        }
    }

    public String contentType(String fileName) {
        if (fileName.endsWith(".jpg")) return "image/jpeg";
        if (fileName.endsWith(".png")) return "image/png";
        if (fileName.endsWith(".webp")) return "image/webp";
        if (fileName.endsWith(".gif")) return "image/gif";
        if (fileName.endsWith(".mp4")) return "video/mp4";
        if (fileName.endsWith(".webm")) return "video/webm";
        if (fileName.endsWith(".mov")) return "video/quicktime";
        return "application/octet-stream";
    }

    private String managedFileName(String url) {
        if (url == null || !url.startsWith("/api/v1/media/")) return null;
        String fileName = url.substring("/api/v1/media/".length());
        return validFileName(fileName) ? fileName : null;
    }

    private boolean validFileName(String fileName) {
        return fileName.matches("^[0-9a-f-]{36}\\.(jpg|png|webp|gif|mp4|webm|mov)$");
    }

    private void deleteOnRollback(String fileName) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) deleteNow(fileName);
            }
        });
    }

    private void deleteAfterCommit(Set<String> fileNames) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            fileNames.forEach(this::deleteNow); return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { fileNames.forEach(MediaService.this::deleteNow); }
        });
    }

    private void deleteNow(String fileName) {
        if (!validFileName(fileName)) return;
        try { Files.deleteIfExists(root.resolve(fileName).normalize()); }
        catch (IOException ignored) { /* Database state remains authoritative; a cleanup job may retry orphan files. */ }
    }

    public record StoredMedia(String mediaType, String url, String contentType, long size) {}
}
