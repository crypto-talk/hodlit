package com.cryptalk.draft;

import com.cryptalk.post.PostDtos.MediaRequest;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class DraftDtos {
    private DraftDtos() {}

    @Schema(description = "임시저장 전체 교체 요청. 생략한 필드는 null로 저장하며 빈 제목·본문·방을 허용합니다.")
    public record SaveDraftRequest(
        @Size(max = 20) String coinSymbol,
        @Size(max = 120) String title,
        @Size(max = 5000) String content,
        @Size(max = 8) List<@NotNull @Valid MediaRequest> media,
        @Size(max = 80) String tradingViewSymbol,
        @Pattern(regexp = "^(|1|3|5|15|30|45|60|120|180|240|D|W|M)$") String tradingViewInterval,
        @Size(max = 5000) String tradingViewAnalysis,
        @DecimalMin(value = "0.0", inclusive = false) BigDecimal assetPrice,
        @Pattern(regexp = "^$|^[A-Z0-9]{2,10}$") String assetPriceCurrency,
        @Size(max = 500) String youtubeUrl
    ) {}

    public record DraftResponse(Long id, Instant updatedAt, String coinSymbol, String title, String content,
                                List<MediaRequest> media, String tradingViewSymbol, String tradingViewInterval,
                                String tradingViewAnalysis, BigDecimal assetPrice, String assetPriceCurrency,
                                String youtubeUrl) {}
}
