package com.cryptalk.post;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class PostDtos {
    private PostDtos() {}
    public record CreatePostRequest(
        @NotBlank String coinSymbol,
        @NotBlank @Size(max=120) String title,
        @NotBlank @Size(max=5000) String content,
        @Size(max=8) List<@Valid MediaRequest> media,
        @Size(max=80) String tradingViewSymbol,
        @Pattern(regexp="^(1|3|5|15|30|45|60|120|180|240|D|W|M)$") String tradingViewInterval,
        @Size(max=5000) String tradingViewAnalysis,
        @DecimalMin(value="0.0", inclusive=false) BigDecimal assetPrice,
        @Pattern(regexp="^[A-Z0-9]{2,10}$") String assetPriceCurrency,
        @Size(max=500) String youtubeUrl
    ) {}
    public record UpdatePostRequest(
        @NotBlank @Size(max=120) String title,
        @NotBlank @Size(max=5000) String content,
        @Size(max=8) List<@Valid MediaRequest> media,
        @Size(max=80) String tradingViewSymbol,
        @Pattern(regexp="^(1|3|5|15|30|45|60|120|180|240|D|W|M)$") String tradingViewInterval,
        @Size(max=5000) String tradingViewAnalysis,
        @DecimalMin(value="0.0", inclusive=false) BigDecimal assetPrice,
        @Pattern(regexp="^[A-Z0-9]{2,10}$") String assetPriceCurrency,
        @Size(max=500) String youtubeUrl
    ) {}
    public record MediaRequest(PostMedia.MediaType type, @NotBlank @Size(max=1000) String url, @Size(max=1000) String thumbnailUrl) {}
    public record AuthorResponse(Long id, String nickname, String avatarColor) {}
    public record MediaResponse(Long id, String type, String url, String thumbnailUrl, int order) {}
    public record TradingViewResponse(String symbol, String interval, String analysis) {}
    public record PriceSnapshotResponse(BigDecimal price, String currency, Instant capturedAt, String source) {}
    @Schema(description = "작성 당시 확인된 잔액 기준의 불변 보유 기록. 일부 조회 실패 시에도 양수 부분합은 HOLDER로 인증하며 PARTIAL을 유지합니다. 수량 구간은 확인된 부분합 기준입니다.")
    public record HolderSnapshotResponse(String verificationAvailability, String verificationLevel,
                                         boolean verifiedHolder, String quantityBand, Integer holdingMonths,
                                         int walletCount, Instant capturedAt, Long blockNumber, String syncStatus, String holderStatus, com.cryptalk.badge.BadgeSnapshot badge) {}
    public record YoutubeResponse(String url, String videoId, String thumbnailUrl) {}
    public record PostResponse(Long id, String coinSymbol, String title, String content, AuthorResponse author,
                               boolean verifiedHolder, BigDecimal assetValueKrw, String assetDisplay,
                               long likes, long comments, boolean liked, Instant createdAt, Instant updatedAt,
                               List<MediaResponse> media, TradingViewResponse tradingView, PriceSnapshotResponse priceSnapshot,
                               YoutubeResponse youtube, long reposts, boolean reposted, boolean bookmarked,
                               HolderSnapshotResponse holderSnapshot) {}
    public record FeedItemResponse(String eventType, Instant occurredAt, AuthorResponse actor, PostResponse post) {}
    public record FeedPageResponse(List<FeedItemResponse> items, String nextCursor, boolean hasMore) {}
}
