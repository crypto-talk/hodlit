# 일일 투표 기록·결과 API (HODL-102)

경로는 `/api/v1` 기준입니다. 날짜는 KST `YYYY-MM-DD`, 시각은 UTC ISO-8601입니다.

| API | 동작 |
| --- | --- |
| `GET /communities/{symbol}/polls/results?page=0&size=20` | 방의 공개 결과. 어제까지와 종료된 투표의 오늘 결과를 `(투표, 날짜)`별로 반환 |
| `GET /polls/{pollId}/results?from=2026-10-01&to=2026-10-30&page=0&size=20` | 투표의 날짜별 결과. 양 끝 날짜 포함 |
| `GET /me/votes?page=0&size=20` | 인증된 본인의 선택·참여 시각·해당 날짜 전체 집계 |

`from` 기본값은 1970-01-01, `to` 기본값은 어제(종료 투표는 오늘)입니다.
진행 중인 오늘을 명시적으로 요청하면 오늘 참여한 사용자만 조회할 수 있습니다.
익명·미참여자·미참여 관리자는 403, 미래 날짜나 역전된 범위는 400입니다.
기존 `GET /polls/{pollId}`도 종료된 투표의 오늘 집계를 익명에게 공개합니다.
방 결과 및 투표별 결과는 기존 방 접근 정책을 적용합니다(닫힌 방 403, 비활성/없는 방 404).
본인 기록은 방이 닫혀도 열람할 수 있습니다. 다른 회원 ID를 입력받는 기록 API는 제공하지 않습니다.

관리자가 삭제한 투표는 방의 공개 결과와 내 투표 기록에서 제외됩니다. 삭제된 투표 ID의 날짜별 결과 조회는 404를 반환합니다.

세 API 모두 `PageResponse`(`items`, `page`, `size`, `totalElements`, `totalPages`,
`hasNext`, `hasPrevious`)를 사용합니다. page는 0 이상, size는 1~100(기본 20)입니다.
결과는 날짜·투표 ID 내림차순, 내 기록은 날짜·기록 ID 내림차순입니다.
참여가 있었던 날짜만 목록에 포함하고, 선택지의 0표는 반환합니다.

결과 항목:

```json
{
  "pollId": 1,
  "coinSymbol": "ETH",
  "question": "오를까?",
  "active": false,
  "day": "2026-10-30",
  "totalVotes": 1,
  "choices": [{"id": 1, "label": "상승", "voteCount": 1}, {"id": 2, "label": "하락", "voteCount": 0}],
  "holderResults": [{"holderStatus": "HOLDER", "totalVotes": 1, "choices": [{"id": 1, "label": "상승", "voteCount": 1}, {"id": 2, "label": "하락", "voteCount": 0}]}]
}
```

`holderResults`는 투표 시점의 보유 상태별 집계입니다. `HOLDER`, `EMPTY`, `UNKNOWN`,
`NOT_CONNECTED` 중 실제 참여가 있는 그룹만 반환합니다. 과거 기록의 NULL 상태는
`UNKNOWN`에 포함합니다. 회원 목록·지갑·개인별 보유 상태·수량 구간·가격은 반환하지 않습니다.

내 기록 항목은 `id`, `day`, `votedAt`, `choiceId`, `choiceLabel`, `result`입니다.
`result`는 위 결과 형식의 해당 날짜 현재 집계이며, 별도로 동결한 결과는 아닙니다.

신규 투표는 다음 스냅샷을 서버에서 저장합니다.

- `voted_at`: 자산·가격 조회 후 최종 시각. 같은 시각에서 KST 참여 날짜를 계산합니다.
- `price`, `price_currency`, `price_source`, `price_captured_at`: 글 발행과 동일한
  `MarketPriceService` USD CoinGecko 가격(20초 캐시 포함)과 가격 관측 시각.
- `holder_status`, `quantity_band`: 글 발행과 같은 `AssetService.snapshotForPublication` 검증 결과.
  정확 수량·금액은 투표 테이블에 저장하지 않습니다.

시세 미지원(422) 또는 시세 장애(503)는 참여를 막지 않고 가격 필드를 NULL로 남깁니다.
미연결은 `NOT_CONNECTED`, 인증 미지원 또는 신선도 검증 실패는 `UNKNOWN`입니다.
기존 투표의 시각·가격·보유 상태를 소급해서 채우지 않습니다. 이후 자산 갱신도 이전 투표의
스냅샷을 덮어쓰지 않습니다. 신규 마이그레이션은 `023-poll-vote-history.sql`입니다.

회원·투표 잠금과 기존 `(poll_id, member_id, vote_date)` 유일 제약을 유지합니다.
투표 쓰기는 READ_COMMITTED를 사용하여 잠금 대기 후 최신 참여 기록을 확인합니다.
사용자당 KST 하루 1회, 선택 변경 불가, 자정에 다음 날 참여 가능 정책은 동일합니다.

공개 프로필의 개인별 투표 기록은 공개 정책 결정 전까지 제외합니다. 자동 마감·결과 동결·
다음 날 가격을 사용한 적중률 계산은 선택 범위로 이번 변경에 포함하지 않습니다.
프론트 화면 변경은 별도 작업입니다.
