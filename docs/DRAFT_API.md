# 글 임시저장 API (HODL-43)

모든 요청은 `Authorization: Bearer <accessToken>`이 필요합니다. JWT 회원 본인의 임시저장만 접근할 수 있습니다.

| 메서드 | URL | 성공 응답 |
| --- | --- | --- |
| GET | `/api/v1/drafts` | 200, 최근 수정순 배열 (`updatedAt DESC, id DESC`) |
| GET | `/api/v1/drafts/{id}` | 200, 임시저장 객체 |
| POST | `/api/v1/drafts` | 201, 생성된 임시저장 객체 |
| PUT | `/api/v1/drafts/{id}` | 200, 전체 교체된 임시저장 객체 |
| DELETE | `/api/v1/drafts/{id}` | 204 |

## 요청과 응답

POST/PUT은 `CreatePostRequest`와 같은 필드 이름을 사용합니다. 응답에는 같은 필드와 `id`, `updatedAt`(UTC ISO 8601)이 추가됩니다.

```json
{
  "coinSymbol": "ETH",
  "title": "작성 중인 제목",
  "content": "# Markdown\n\n본문",
  "media": [{"type": "IMAGE", "url": "/api/v1/media/<uuid>.png", "thumbnailUrl": null}],
  "tradingViewSymbol": "BINANCE:ETHUSDT",
  "tradingViewInterval": "60",
  "tradingViewAnalysis": null,
  "assetPrice": null,
  "assetPriceCurrency": null,
  "youtubeUrl": null
}
```

- `{}` 및 빈 제목·본문·방을 허용합니다. Markdown과 공백은 그대로 보존하며 방 존재 여부를 조회하지 않습니다.
- 제목 120자, 본문 5000자, 미디어 8개, coinSymbol 20자, youtubeUrl 500자 제한입니다. 작성 중인 YouTube URL도 보존하고 발행 API에서 최종 형식을 검증합니다.
- 추가 필드는 기존 글 작성 제한을 적용합니다. tradingViewSymbol 80자, tradingViewAnalysis 5000자, interval은 빈 문자열 또는 `1/3/5/15/30/45/60/120/180/240/D/W/M`, assetPrice는 양수, currency는 빈 문자열 또는 대문자 영숫자 2~10자입니다.
- 미디어는 `IMAGE`/`VIDEO` 형식과 URL이 필요합니다. URL/thumbnailUrl은 최대 1000자, 업로드 URL 또는 HTTPS URL이어야 합니다. null 항목과 중복 기본 URL은 거부합니다.
- PUT은 전체 교체입니다. 생략한 필드는 null이 됩니다. 동시에 저장하면 서버에서 마지막으로 처리한 요청이 남습니다.
- 지갑·시세 조회 및 보유/가격 스냅샷 생성은 수행하지 않습니다. assetPrice는 입력값으로만 보관합니다.

## 보관 및 발행 정책

- 회원당 최대 10개. 초과 생성은 409입니다. 수정·삭제는 계속 가능합니다. 동시 생성도 회원 잠금으로 제한합니다.
- 자동 만료 및 오래된 임시저장 자동 삭제는 없습니다.
- 발행은 기존 `POST /api/v1/posts`에 저장 필드를 보내고, 성공 후 프론트가 `DELETE /api/v1/drafts/{id}`를 호출합니다. 발행 실패 시 초안은 남습니다. 발행은 기존 필수값/형식 검증을 적용하며 보유·시세 스냅샷은 이때 기록됩니다.
- 서버 업로드 미디어와 썸네일은 `media_assets.draft_id`로 보호합니다. 다른 회원 업로드, 이미 발행된 파일, 다른 초안에 연결된 파일을 새로 연결하면 거부합니다. 파일 하나는 초안 하나에 연결할 수 있습니다.
- 발행 시 미디어를 게시글에 연결하고 `draft_id`를 해제합니다. 발행 후 초안 삭제는 게시글 파일을 삭제하지 않습니다. 발행 후에는 초안을 수정하지 말고 삭제하세요.
- 초안 수정에서 빠진 파일 또는 초안 삭제 시 파일은 연결만 해제하며 즉시 지우지 않습니다. 이후 직접 미디어 DELETE가 가능합니다.
- 연결된 파일의 직접 DELETE는 409입니다. 향후 미발행 미디어 정리는 반드시 `post_id IS NULL AND draft_id IS NULL`을 조건으로 사용해야 합니다. `deleteManagedAfterCommit`도 초안 연결 파일을 보호합니다.

## 오류

401: 인증 없음/만료, 403: 다른 회원 초안/업로드, 404: 없는 초안, 400: 길이/형식/누락된 업로드 기록, 409: 개수 제한 또는 파일 연결 충돌. 오류는 기존 `{message, timestamp}` 형식을 사용합니다.

## DB 변경

Liquibase `010-post-drafts.sql`이 `drafts`와 회원별 수정순 인덱스, `media_assets.draft_id` FK/인덱스를 추가합니다. 회원 삭제 시 초안은 CASCADE 삭제되며 초안 삭제 시 미디어 참조는 SET NULL입니다.
