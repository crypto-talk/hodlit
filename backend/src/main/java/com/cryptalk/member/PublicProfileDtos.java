package com.cryptalk.member;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

public final class PublicProfileDtos {
    private PublicProfileDtos() {}

    @Schema(name = "PublicProfile", description = "공개 프로필. 자산 비공개 회원은 assets가 빈 배열입니다. 지갑 주소·정확 수량·평가금액은 반환하지 않습니다.")
    public record ProfileResponse(Long id, String nickname, String avatarColor, Instant joinedAt,
                                  long postCount, long commentCount, List<AssetResponse> assets) {}

    @Schema(name = "PublicProfileAsset", description = "마지막 저장 시점의 확인된 보유 자산. 정확 수량 대신 구간, 보유 시작일 대신 개월만 제공합니다. 외부 자산 조회를 실행하지 않습니다.")
    public record AssetResponse(String coinSymbol, String coinName, String quantityBand, Integer holdingMonths,
                                String verificationLevel, String syncStatus, Instant capturedAt) {}

    @Schema(description = "작성 당시 저장된 글 보유 기록. 회원이 현재 자산 비공개이면 holderSnapshot은 null입니다.")
    public record PostSnapshotResponse(String verificationAvailability, String verificationLevel,
                                       boolean verifiedHolder, String quantityBand, Integer holdingMonths,
                                       Instant capturedAt, String syncStatus, String holderStatus) {}

    @Schema(description = "작성 당시 저장된 댓글 보유 기록. 기존 댓글 계약에 따라 수량 구간도 제공하지 않습니다.")
    public record CommentSnapshotResponse(String verificationAvailability, String verificationLevel,
                                          boolean verifiedHolder, Integer holdingMonths,
                                          Instant capturedAt, String syncStatus, String holderStatus) {}

    @Schema(name = "PublicProfilePost")
    public record PostResponse(Long id, String coinSymbol, String title, String content,
                               Instant createdAt, Instant updatedAt, PostSnapshotResponse holderSnapshot) {}

    @Schema(name = "PublicProfileComment")
    public record CommentResponse(Long id, Long postId, String postTitle, String coinSymbol, String content,
                                  Instant createdAt, Instant updatedAt, Long parentCommentId,
                                  Long replyToCommentId, String replyToNickname,
                                  CommentSnapshotResponse holderSnapshot) {}
}
