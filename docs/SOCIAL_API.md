# SNS API 명세

기본 경로는 `/api/v1`입니다. Swagger UI는 배포 서버의 `/swagger-ui.html`, OpenAPI JSON은
`/v3/api-docs`에서 확인할 수 있습니다. 인증 API에는
`Authorization: Bearer {accessToken}` 헤더가 필요합니다. 공개 조회 API에 토큰을 보내면
`liked`, `reposted`, `bookmarked`, `followedByMe`가 해당 사용자를 기준으로 계산됩니다.

애플리케이션 오류의 공통 응답은 다음과 같습니다.

```json
{
  "message": "요청값을 확인해 주세요.",
  "timestamp": "2026-09-01T10:00:00Z"
}
```

## 엔드포인트

| 기능 | Method | Path | 인증 | 성공 상태 |
|---|---|---|---|---|
| 랜딩 피드 | GET | `/feed?size=30&cursor=...` | 선택 | `200` |
| 팔로잉 피드 | GET | `/feed/following?size=30&cursor=...` | 필요 | `200` |
| 코인별 글 | GET | `/communities/{symbol}/posts?size=30` | 선택 | `200` |
| 글 상세 | GET | `/posts/{postId}` | 선택 | `200` |
| 글 작성 | POST | `/posts` | 필요 | `200` |
| 글 전체 수정 | PUT | `/posts/{postId}` | 필요, 작성자 | `200` |
| 글 삭제 | DELETE | `/posts/{postId}` | 필요, 작성자 | `204` |
| 미디어 업로드 | POST | `/media` | 필요 | `200` |
| 미디어 조회 | GET | `/media/{fileName}` | 불필요 | `200` |
| 미디어 삭제 | DELETE | `/media/{fileName}` | 필요, 업로더 | `204` |
| 댓글 목록 | GET | `/posts/{postId}/comments` | 불필요 | `200` |
| 댓글 작성 | POST | `/posts/{postId}/comments` | 필요 | `200` |
| 댓글 수정 | PATCH | `/comments/{commentId}` | 필요, 작성자 | `200` |
| 댓글 삭제 | DELETE | `/comments/{commentId}` | 필요, 작성자 | `204` |
| 좋아요/취소 | POST / DELETE | `/posts/{postId}/likes` | 필요 | `200` |
| 재게시/취소 | POST / DELETE | `/posts/{postId}/reposts` | 필요 | `200` |
| 북마크/취소 | POST / DELETE | `/posts/{postId}/bookmarks` | 필요 | `200` |
| 내 북마크 | GET | `/me/bookmarks` | 필요 | `200` |
| 팔로우/취소 | POST / DELETE | `/members/{memberId}/follow` | 필요 | `200` |
| 팔로우 통계 | GET | `/members/{memberId}/social` | 선택 | `200` |
| 팔로워 목록 | GET | `/members/{memberId}/followers` | 불필요 | `200` |
| 팔로잉 목록 | GET | `/members/{memberId}/following` | 불필요 | `200` |
| 현재 자산 가격 | GET | `/market/prices/{symbol}?currency=USD` | 불필요 | `200` |
| 내 EVM 자산 집계 | GET | `/me/assets` | 필요 | `200` |

조회 응답의 `liked`, `reposted`, `bookmarked`, `followedByMe`는 로그인 사용자를 기준으로
계산됩니다. 비로그인 조회에서는 `false`입니다. `size`는 1~100 범위로 보정됩니다.

## Cursor 피드

첫 요청에서는 `cursor`를 생략합니다. 다음 페이지는 응답의 `nextCursor`를 그대로 전달합니다.
cursor 내부 형식은 서버 구현 세부사항이므로 클라이언트가 생성하거나 해석하지 않습니다.

```json
{
  "items": [
    {
      "eventType": "REPOST",
      "occurredAt": "2026-09-01T10:05:00Z",
      "actor": { "id": 9, "nickname": "재게시자", "avatarColor": "#..." },
      "post": { "id": 42, "title": "ETH 분석" }
    },
    {
      "eventType": "POST",
      "occurredAt": "2026-09-01T10:00:00Z",
      "actor": { "id": 7, "nickname": "작성자", "avatarColor": "#..." },
      "post": { "id": 42, "title": "ETH 분석" }
    }
  ],
  "nextCursor": "MjAyNi0wOS0wMVQxMDowMDowMFp8UE9TVHw0Mnw3",
  "hasMore": true
}
```

- `eventType=POST`: 원글 작성 이벤트
- `eventType=REPOST`: 재게시 이벤트이며 `actor`는 재게시한 사용자
- `/feed/following`: 내가 팔로우한 사용자의 원글과 재게시 이벤트만 반환
- 마지막 페이지에서는 `hasMore=false`, `nextCursor=null`
- 잘못되었거나 변조된 cursor는 `400 Bad Request`

## 사진·영상 업로드

`POST /media`에 `multipart/form-data`의 `file` 필드로 전송합니다. JPEG, PNG, WebP, GIF,
MP4, WebM, MOV를 지원하며 파일당 최대 크기는 25MB입니다.

```http
POST /api/v1/media
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

file=@chart.png
```

```json
{
  "mediaType": "IMAGE",
  "url": "/api/v1/media/22bb2cdd-832f-4a90-854c-66d73a982873.png",
  "contentType": "image/png",
  "size": 42839
}
```

반환된 `url`을 글 작성 요청의 `media[].url`에 넣습니다. 한 글에는 최대 8개를 순서대로
넣을 수 있습니다. 운영 파일은 Docker named volume `cryptalk-media`에 보존됩니다.
서버에 업로드된 파일은 업로드한 계정만 게시글에 연결할 수 있습니다. 외부 미디어는 사용자
정보가 없는 HTTPS URL만 허용합니다.

아직 게시글에 연결하지 않은 파일은 `DELETE /media/{fileName}`으로 삭제할 수 있습니다.
게시글에 연결된 파일은 직접 삭제할 수 없으며 글 수정에서 제외하거나 글을 삭제해야 합니다.
글 수정·삭제 transaction이 성공하면 서버가 연결이 끊긴 실제 파일도 함께 삭제합니다.

미디어 관련 주요 오류는 다음과 같습니다.

| 상황 | 상태 |
|---|---|
| 빈 파일 또는 잘못된 업로드 기록/URL | `400 Bad Request` |
| 다른 사용자가 업로드한 파일 사용·삭제 | `403 Forbidden` |
| 파일이 없거나 파일명이 올바르지 않음 | `404 Not Found` |
| 게시글에 연결된 파일을 직접 삭제 | `409 Conflict` |
| 25MB 초과 | `413 Payload Too Large` |
| 지원하지 않는 Content-Type | `415 Unsupported Media Type` |

## 글 작성

```http
POST /api/v1/posts
Authorization: Bearer {accessToken}
Content-Type: application/json
```

```json
{
  "coinSymbol": "ETH",
  "title": "ETH 1시간봉 분석",
  "content": "지지 구간을 확인했습니다.",
  "media": [
    {
      "type": "IMAGE",
      "url": "/api/v1/media/22bb2cdd-832f-4a90-854c-66d73a982873.png",
      "thumbnailUrl": null
    }
  ],
  "tradingViewSymbol": "BINANCE:ETHUSDT",
  "tradingViewInterval": "60",
  "tradingViewAnalysis": "1시간봉 지지선 관찰",
  "assetPriceCurrency": "USDT",
  "youtubeUrl": "https://www.youtube.com/shorts/dQw4w9WgXcQ"
}
```

- `media.type`: `IMAGE` 또는 `VIDEO`
- `media.url`, `thumbnailUrl`: 업로드 API가 반환한 경로 또는 사용자 정보가 없는 HTTPS URL
- `tradingViewInterval`: `1`, `3`, `5`, `15`, `30`, `45`, `60`, `120`, `180`, `240`, `D`, `W`, `M`
- `assetPriceCurrency`: 조회 통화이며 기본값은 `USD`입니다. 호환성을 위해 기존
  `assetPrice` 필드는 당분간 받을 수 있지만 값은 사용하지 않습니다. 서버가 CoinGecko
  `/simple/price`에서 현재 가격과 공급자 갱신 시각을 조회합니다.
- `youtubeUrl`: YouTube watch, `youtu.be`, Shorts URL을 지원합니다. 서버가 영상 ID와
  `i.ytimg.com` 썸네일 URL을 파생합니다.

주요 응답 형태는 다음과 같습니다.

```json
{
  "id": 42,
  "coinSymbol": "ETH",
  "title": "ETH 1시간봉 분석",
  "content": "지지 구간을 확인했습니다.",
  "author": { "id": 7, "nickname": "작성자", "avatarColor": "#..." },
  "verifiedHolder": false,
  "assetValueKrw": null,
  "assetDisplay": "자산 비공개",
  "likes": 0,
  "comments": 0,
  "liked": false,
  "createdAt": "2026-08-31T14:00:00Z",
  "updatedAt": "2026-09-01T10:00:00Z",
  "media": [{ "id": 1, "type": "IMAGE", "url": "/api/v1/media/...png", "thumbnailUrl": null, "order": 0 }],
  "tradingView": { "symbol": "BINANCE:ETHUSDT", "interval": "60", "analysis": "1시간봉 지지선 관찰" },
  "priceSnapshot": { "price": 4321.25000000, "currency": "USDT", "capturedAt": "2026-09-01T09:59:40Z", "source": "COINGECKO" },
  "youtube": { "url": "https://www.youtube.com/shorts/dQw4w9WgXcQ", "videoId": "dQw4w9WgXcQ", "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" },
  "reposts": 0,
  "reposted": false,
  "bookmarked": false,
  "holderSnapshot": {
    "verificationAvailability": "SUPPORTED",
    "verificationLevel": "UNVERIFIED",
    "verifiedHolder": false,
    "quantityBand": null,
    "holdingMonths": null,
    "walletCount": 0,
    "capturedAt": "2026-09-01T10:00:00Z",
    "blockNumber": null,
    "syncStatus": "NO_DATA"
  }
}
```

`holderSnapshot`은 발행할 때 한 번 생성하며 이후 수정하거나 지갑을 해제해도 바뀌지 않습니다.
글·댓글 작성 시 잔액을 다시 조회하지 않고 DB에 저장된 해당 코인의 자산 스냅샷을 사용합니다.
잔액 인증은 작성자 표시용이며 작성 권한의 조건이 아닙니다. 저장된 스냅샷이 없으면 미인증으로
작성할 수 있고, RPC가 미설정이거나 장애가 발생해도 글·댓글 작성은 막히지 않습니다.
이전에 저장된 인증 스냅샷이 있으면 마지막으로 확인한 정보를 사용합니다.
Ethereum mainnet ETH는 `SUPPORTED`, 설정이 덜 된 ERC-20은 `NOT_CONFIGURED`, BTC·SOL 같은
비EVM 자산은 `NOT_SUPPORTED`입니다. 비EVM 자산은 단순 미인증과 구분하기 위해
`verificationLevel=null`을 반환합니다.

좋아요·재게시·북마크·팔로우의 POST는 같은 요청을 반복해도 중복 생성되지 않으며,
DELETE도 이미 취소된 상태에서 안전하게 반복할 수 있습니다.

## 글과 댓글 수정

`PUT /posts/{postId}`는 제목, 내용, 미디어 및 분석 메타데이터를 전체 교체합니다. `coinSymbol`은
변경하지 않습니다. `media`를 생략하거나 빈 배열로 보내면 기존 미디어가 제거됩니다. 수정은
`updatedAt`만 갱신하며 발행 당시 가격과 `holderSnapshot`을 다시 조회하거나 덮어쓰지 않습니다.

```json
{
  "title": "수정된 ETH 분석",
  "content": "수정된 내용입니다.",
  "media": [],
  "tradingViewSymbol": "BINANCE:ETHUSDT",
  "tradingViewInterval": "60",
  "tradingViewAnalysis": "수정된 분석",
  "assetPriceCurrency": "KRW",
  "youtubeUrl": null
}
```

댓글은 `PATCH /comments/{commentId}`에 `{"content":"수정 내용"}`을 보내 수정합니다. 글과 댓글
모두 작성자만 수정할 수 있으며 다른 사용자는 `403 Forbidden`을 받습니다.

댓글 내용은 공백일 수 없고 최대 1,000자입니다. 작성·수정 및 목록의 댓글 응답은 다음
형태입니다.

```json
{
  "id": 81,
  "memberId": 9,
  "nickname": "댓글작성자",
  "avatarColor": "#627eea",
  "content": "수정된 댓글입니다.",
  "createdAt": "2026-09-01T10:00:00Z",
  "updatedAt": "2026-09-01T10:05:00Z",
  "holderSnapshot": {
    "verificationAvailability": "SUPPORTED",
    "verificationLevel": "WALLET",
    "verifiedHolder": true,
    "holdingMonths": null,
    "walletCount": 2,
    "capturedAt": "2026-09-01T10:00:00Z",
    "syncStatus": "READY"
  }
}
```

댓글 스냅샷은 정확한 수량을 내부에 저장하지만 공개 응답에는 수량과 수량 구간을 포함하지 않습니다.

## 내 EVM 자산 집계

`GET /me/assets`는 연결된 모든 EVM 지갑의 Ethereum mainnet ETH 잔액을 합산합니다. 지갑 하나라도
조회에 실패하면 불완전한 합계를 저장하지 않고 `503 Service Unavailable`을 반환합니다.
실패한 갱신은 기존 스냅샷을 덮어쓰지 않습니다. 이 API의 잔액 갱신 실패는 글·댓글 작성 권한과
무관하며, 글·댓글 발행 경로에서는 RPC 잔액 조회를 호출하지 않습니다.

```json
{
  "walletCount": 2,
  "assets": [
    {
      "symbol": "ETH",
      "quantity": 12.345,
      "valueKrw": 53346954.75,
      "quantityBand": "10~100 ETH",
      "verified": true,
      "verificationLevel": "WALLET",
      "status": "VERIFIED",
      "walletCount": 2,
      "holdingSince": null,
      "holdingMonths": null,
      "capturedAt": "2026-09-05T10:00:00Z",
      "blockNumber": null,
      "syncStatus": "READY"
    }
  ]
}
```

보유 시작일과 block number는 아직 EVM history indexer가 없으므로 `null`입니다. 거짓 취득일을
만들지 않고 indexer 연동 후 채웁니다. ERC-20은 contract address와 decimals 및 잔액 client가
구성된 뒤 같은 응답에 추가합니다.

## 소셜 동작 응답

좋아요·재게시·북마크 API는 변경 후의 전체 게시글 응답을 반환합니다. 팔로우 API와
`GET /members/{memberId}/social`은 다음 형태를 반환합니다.

```json
{
  "memberId": 7,
  "followers": 12,
  "following": 4,
  "followedByMe": true
}
```

팔로워·팔로잉 목록의 각 항목은 `id`, `nickname`, `avatarColor`를 포함합니다. 자기 자신을
팔로우하면 `400 Bad Request`, 존재하지 않는 회원은 `404 Not Found`입니다.

## 실시간 가격

`GET /market/prices/ETH?currency=KRW`는 서버가 현재 가격과 24시간 등락률을 조회해 다음 형태로 반환합니다.

```json
{
  "symbol": "ETH",
  "price": 4321000.50,
  "currency": "KRW",
  "change24h": 2.75,
  "capturedAt": "2026-09-01T09:59:40Z",
  "source": "COINGECKO"
}
```

`GET /market/prices?currency=KRW`는 모든 활성 코인의 같은 응답 객체를 표시 순서대로 배열로
반환합니다. 공급자에는 코인 ID를 묶어 한 번만 요청하므로 커뮤니티 화면은 이 API를 30초마다
호출합니다. `change24h`는 공급자가 등락률을 제공하지 않으면 `null`일 수 있습니다.

가격은 20초간 서버 캐시를 사용합니다. 공급자 장애나 rate limit으로 조회하지 못하면
`503 Service Unavailable`을 반환하며 가격이 없는 게시글을 저장하지 않습니다. 운영 환경은
`MARKET_PRICE_BASE_URL`로 공급자 호스트를 교체할 수 있습니다. 기본 구현은
[CoinGecko Keyless Public API](https://docs.coingecko.com/docs/keyless-public-api)의
[`/simple/price`](https://docs.coingecko.com/reference/simple-price)를 사용합니다.

| 상황 | 상태 |
|---|---|
| 통화 형식이 `^[A-Z0-9]{2,10}$`에 맞지 않음 | `400 Bad Request` |
| 활성 코인 심볼이 없음 | `404 Not Found` |
| 코인은 있지만 가격 공급자 ID가 없음 | `422 Unprocessable Entity` |
| 가격 공급자 timeout, 장애, rate limit 또는 응답 누락 | `503 Service Unavailable` |
