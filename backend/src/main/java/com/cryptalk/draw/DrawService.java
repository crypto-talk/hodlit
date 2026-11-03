package com.cryptalk.draw;

import com.cryptalk.admin.AdminAccess;
import com.cryptalk.common.ApiException;
import com.cryptalk.common.PageResponse;
import com.cryptalk.member.MemberRepository;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DrawService {
    private final com.cryptalk.media.MediaAssetRepository media;
    private final DrawEventRepository events;
    private final DrawPrizeRepository prizes;
    private final DrawResultRepository results;
    private final MemberRepository members;
    private final AdminAccess admins;
    private final SecureRandom random = new SecureRandom();

    public DrawService(DrawEventRepository events, DrawPrizeRepository prizes, DrawResultRepository results,
            MemberRepository members, AdminAccess admins, com.cryptalk.media.MediaAssetRepository media) {
        this.events = events;
        this.media = media;
        this.prizes = prizes;
        this.results = results;
        this.members = members;
        this.admins = admins;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminEvent> list(Long actor, int page, int size) {
        admins.requireAdmin(actor);
        return PageResponse.of(events.findAll(PageResponse.request(page, size, Sort.by(Sort.Direction.DESC, "id"))).map(this::adminResponse));
    }

    @Transactional(readOnly = true)
    public AdminEvent adminDetail(Long actor, Long id) {
        admins.requireAdmin(actor);
        return adminResponse(find(id));
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AdminEvent save(Long actor, Long id, EventRequest request) {
        admins.requireAdmin(actor);
        if (!Instant.now().isBefore(request.startsAt())) throw bad("시작 시각은 현재보다 이후여야 합니다.");
        if (!request.startsAt().isBefore(request.endsAt())) throw bad("시작 시각은 종료 시각보다 빨라야 합니다.");
        DrawEvent event;
        if (id == null) event = events.save(new DrawEvent(request));
        else {
            event = lock(id);
            requireEditable(event);
            event.update(request);
        }
        return adminResponse(event);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AdminEvent replacePrizes(Long actor, Long id, List<PrizeRequest> requests) {
        admins.requireAdmin(actor);
        DrawEvent event = lock(id);
        requireEditable(event);
        long total = 0;
        var names = new java.util.HashSet<String>();
        for (PrizeRequest request : requests) {
            if (!names.add(request.name().strip())) throw bad("상품명이 중복되었습니다.");
            validateImage(actor, request.imageUrl());
            try { total = Math.addExact(total, request.weight().longValueExact()); }
            catch (ArithmeticException exception) { throw bad("가중치 합계가 너무 큽니다."); }
        }
        prizes.deleteByEventId(id);
        prizes.flush();
        for (PrizeRequest request : requests) prizes.save(new DrawPrize(event, request));
        prizes.flush();
        return adminResponse(event);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AdminEvent status(Long actor, Long id, String status) {
        admins.requireAdmin(actor);
        DrawEvent event = lock(id);
        if (!List.of("ACTIVE", "PAUSED").contains(status)) throw bad("상태는 ACTIVE 또는 PAUSED여야 합니다.");
        if (status.equals("ACTIVE")) {
            if (!Instant.now().isBefore(event.getEndsAt())) throw bad("종료된 이벤트는 활성화할 수 없습니다.");
            if (!event.isPublished() && !Instant.now().isBefore(event.getStartsAt()))
                throw bad("최초 활성화는 시작 시각 전에 완료해 주세요.");
            if (prizes.findByEventIdOrderByDisplayOrderAscIdAsc(id).isEmpty()) throw bad("상품을 먼저 설정해 주세요.");
        } else if (!event.isPublished()) throw bad("활성화된 이벤트만 중지할 수 있습니다.");
        event.changeStatus(status);
        return adminResponse(event);
    }

    @Transactional(readOnly = true)
    public PublicEvent detail(Long id) {
        DrawEvent e = find(id);
        if (!e.isPublished()) throw new ApiException(HttpStatus.NOT_FOUND, "이벤트를 찾을 수 없습니다.");
        return new PublicEvent(e.getId(), e.getTitle(), e.getDescription(), e.getStartsAt(), e.getEndsAt(), e.getStatus(),
            available(e), prizes.findByEventIdOrderByDisplayOrderAscIdAsc(id).stream()
                .map(p -> new PublicPrize(p.getId(), p.getName(), p.getImageUrl(), p.getDescription(), p.getDisplayOrder())).toList());
    }

    @Transactional(readOnly = true)
    public Participation me(Long actor, Long id) {
        requireMember(actor);
        detail(id);
        return new Participation(results.findByEventIdAndMemberId(id, actor).map(r -> result(r, true)).orElse(null));
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public Result draw(Long actor, Long id) {
        requireMember(actor);
        DrawEvent event = lock(id); // Serializes draws and settings across all application instances.
        var previous = results.findByEventIdAndMemberId(id, actor);
        if (previous.isPresent()) return result(previous.get(), true);
        if (!available(event)) throw new ApiException(HttpStatus.CONFLICT, "현재 참여할 수 없는 이벤트입니다.");
        var choices = prizes.findByEventIdOrderByDisplayOrderAscIdAsc(id);
        long total = 0;
        for (DrawPrize prize : choices) total = Math.addExact(total, prize.getWeight());
        if (total <= 0) throw new ApiException(HttpStatus.CONFLICT, "상품 설정이 준비되지 않았습니다.");
        long ticket = random.nextLong(total);
        for (DrawPrize prize : choices) {
            if (ticket < prize.getWeight()) return result(results.saveAndFlush(new DrawResult(id, actor, prize)), false);
            ticket -= prize.getWeight();
        }
        throw new IllegalStateException("Invalid prize configuration");
    }

    private void requireMember(Long id) {
        if (id == null || !members.existsById(id)) throw new ApiException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
    }
    private void requireEditable(DrawEvent event) {
        if (!event.getStatus().equals("DRAFT") || !Instant.now().isBefore(event.getStartsAt()) || results.existsByEventId(event.getId()))
            throw new ApiException(HttpStatus.CONFLICT, "시작 전 초안만 변경할 수 있습니다.");
    }
    private boolean available(DrawEvent e) {
        Instant now = Instant.now();
        return e.isPublished() && e.getStatus().equals("ACTIVE") && !now.isBefore(e.getStartsAt()) && now.isBefore(e.getEndsAt());
    }
    private void validateImage(Long actor, String url) {
        try {
            URI uri = URI.create(url);
            if (url.matches("/api/v1/media/[0-9a-f-]{36}\\.(jpg|png|webp|gif)")) {
                var asset = media.lockByFileName(url.substring("/api/v1/media/".length()))
                    .orElseThrow(() -> bad("이미지 업로드 기록이 없습니다."));
                if (!asset.getMember().getId().equals(actor) || asset.getPost() != null || asset.getDraftId() != null)
                    throw bad("본인이 업로드한 미사용 이미지만 설정할 수 있습니다.");
                return;
            }
            if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null) return;
        } catch (IllegalArgumentException ignored) { }
        throw bad("상품 이미지는 HTTPS 또는 업로드 이미지 URL이어야 합니다.");
    }
    private DrawEvent find(Long id) {
        return events.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "이벤트를 찾을 수 없습니다."));
    }
    private DrawEvent lock(Long id) {
        return events.lockById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "이벤트를 찾을 수 없습니다."));
    }
    private AdminEvent adminResponse(DrawEvent e) {
        return new AdminEvent(e.getId(), e.getTitle(), e.getDescription(), e.getStartsAt(), e.getEndsAt(), e.getStatus(),
            prizes.findByEventIdOrderByDisplayOrderAscIdAsc(e.getId()).stream()
                .map(p -> new AdminPrize(p.getId(), p.getName(), p.getImageUrl(), p.getDescription(), p.getWeight(), p.getDisplayOrder())).toList());
    }
    private Result result(DrawResult r, boolean existing) {
        return new Result(r.getId(), r.getEventId(), r.getPrizeId(), r.getPrizeName(), r.getImageUrl(), r.getCapturedAt(), existing);
    }
    private static ApiException bad(String message) { return new ApiException(HttpStatus.BAD_REQUEST, message); }
    public record EventRequest(@NotBlank @Size(max = 100) String title, @NotNull @Size(max = 2000) String description,
            @NotNull Instant startsAt, @NotNull Instant endsAt) {}
    public record PrizeRequest(@NotBlank @Size(max = 100) String name, @NotBlank @Size(max = 1000) String imageUrl,
            @NotNull @Size(max = 1000) String description, @NotNull @DecimalMin("1") @DecimalMax("9223372036854775807") @Digits(integer = 19, fraction = 0) java.math.BigDecimal weight, @NotNull @Min(0) Integer displayOrder) {}
    public record AdminPrize(Long id, String name, String imageUrl, String description, long weight, int displayOrder) {}
    public record PublicPrize(Long id, String name, String imageUrl, String description, int displayOrder) {}
    public record AdminEvent(Long id, String title, String description, Instant startsAt, Instant endsAt, String status, List<AdminPrize> prizes) {}
    public record PublicEvent(Long id, String title, String description, Instant startsAt, Instant endsAt, String status, boolean canParticipate, List<PublicPrize> prizes) {}
    @io.swagger.v3.oas.annotations.media.Schema(name = "DrawOutcome")
    public record Result(Long id, Long eventId, Long prizeId, String prizeName, String imageUrl, Instant capturedAt, boolean existing) {}
    public record Participation(Result result) {}
}
