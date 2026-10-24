package com.cryptalk.coin;

@io.swagger.v3.oas.annotations.media.Schema(description = "방 운영 상태. OPEN: 정상 이용, CLOSE: 콘텐츠 접근·참여 차단")
public enum RoomOperationStatus {
    OPEN, CLOSE
}
