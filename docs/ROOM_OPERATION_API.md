# Room operation status (HODL-77)

Room operation uses `operationStatus: OPEN | CLOSE`, independently of the coin catalog's `active` flag. Liquibase `014-room-operation-status.sql` initializes ETH as OPEN and all other existing rooms as CLOSE. New coins default to CLOSE until a service administrator opens them. The database constrains the allowed values.

## 기타 방 (HODL-87)

Liquibase `025-other-room.sql`은 전용 방이 없는 코인을 이야기할 수 있는 기타(`OTHER`) 방을 활성·`OPEN` 상태로 등록합니다. 기존에 같은 심볼이 있으면 방 ID와 게시글을 보존하고 게시판 전용 설정을 적용합니다. 다른 방의 운영 상태는 기존 값을 사용합니다.

- `GET /api/v1/coins` 및 `/coins/page`에서는 `OTHER`가 마지막입니다. `GET /api/v1/communities/OTHER`는 방 정보와 게시글 수를 반환합니다. `verificationAvailability`는 `NOT_SUPPORTED`이며 `chainId`와 `assetType`은 `null`입니다.
- 전체 시세 목록에는 시세를 지원하는 활성 코인만 포함됩니다. `GET /api/v1/market/prices/OTHER`는 `422`입니다.
- 글·댓글 작성과 조회는 기존 방 API를 사용합니다. 기타 방 자체의 시세·보유 스냅샷은 생성하지 않습니다. 글의 `verifiedHolder`는 `false`이고 `priceSnapshot`과 `holderSnapshot`은 `null`입니다. 글에서 직접 선택한 실제 코인의 기록은 기존 `attachedCoinSnapshots`로 제공합니다.
- 코인 카탈로그를 기준으로 합산하는 지갑·거래소 자산, 공개 프로필 자산, 코인별 공개 설정에서 `OTHER`를 제외합니다.
- 기타 방은 뉴스와 투표를 제공하지 않습니다. 뉴스·지난 투표 결과 목록은 빈 페이지를 반환하고, 현재 투표는 `404`입니다. 뉴스·투표 등록은 `422 + ROOM_FEATURE_UNSUPPORTED`입니다.
- 화면은 `symbol: "OTHER"`를 기준으로 방 시세·보유 배지·뉴스·투표 대신 게시판을 표시할 수 있습니다. 선택 첨부 코인의 배지는 방 자체의 배지와 구분합니다.

## Service administrator endpoints

Service-wide administrators are persisted as `members.role = 'ADMIN'` and verified using the validated JWT subject on each request. Existing and new members default to `USER`. See ADMIN_PERMISSIONS.md for grant/revoke SQL. Client-supplied roles do not grant access.

| Method and path | Contract |
| --- | --- |
| `GET /api/v1/admin/communities?q=&operationStatus=CLOSE&page=0&size=20` | All catalog rooms, including inactive coins; case-insensitive literal substring search of name/symbol; optional OPEN/CLOSE filter; common numbered page metadata. Query max 100 chars, size 1..100. Stable display-order/ID ordering. |
| `PATCH /api/v1/admin/communities/{symbol}/status` | JSON `{ "operationStatus": "OPEN" }` or `{ "operationStatus": "CLOSE" }`. Symbol is case-insensitive. Returns the updated room. Repeating the same state is idempotent. |

Room fields: `id`, `symbol`, `name`, `active`, `operationStatus`. Anonymous requests return 401; authenticated non-administrators return 403; invalid states/ranges return 400; unknown symbols return 404. Setting operationStatus does not activate an inactive catalog coin. State changes are transactional and serialized per room, and are flushed before returning.

## Public room discovery

`GET /coins`, `GET /coins/page`, and `GET /communities/{symbol}` continue returning active catalog coins, including CLOSE rooms. The coin DTO includes `operationStatus` so the UI can label them and disable write-room selection. Closed community metadata returns `postCount: 0`; it does not disclose the preserved content count. Unknown/inactive community symbols remain 404.

For CLOSE content requests the response is HTTP **403**, with:

```json
{
  "code": "ROOM_CLOSED",
  "message": "현재 닫힌 방입니다.",
  "timestamp": "2026-10-24T00:00:00Z"
}
```

Existing API errors keep their `{message, timestamp}` shape; `code` is added only for coded domain errors. Clients should branch on the code and provide navigation to an OPEN room. A service administrator uses the same public content restrictions; this feature supplies no moderation bypass.

## Closed-room behavior

- Room post lists (legacy/numbered), post details, comments (legacy/numbered), room search, room statistics, public news and polls are blocked.
- Publishing, editing, deleting, liking, bookmarking, reposting, comment/reply mutations and poll voting are blocked, including direct post/comment/poll-ID requests. Undo actions are blocked too. Invalid/missing authentication still follows the existing security rules.
- New/updated edit drafts tied to a closed original post are blocked; private saved-draft recovery/deletion remains available and publishing is always gated by the original room policy.
- Global/following feeds (cursor and numbered), global post pages, bookmarks, global search and room activity statistics exclude closed content. Filters apply before pagination/counting. Search room results currently include only OPEN rooms; catalog discovery still shows CLOSE rooms.
- Existing posts, comments, media references, snapshots, reactions and poll records are preserved. Opening a room restores their normal visibility and participation without recalculating historical proofs or prices. Closing does not record post detail views.
- Wallet/exchange connections, asset lookup, verification capability and coin market prices continue to use catalog activation and are unaffected by room closure.
- For rooms that support news and polls, preparation and management remain available to admins even while closed. Public viewing and voting resume after OPEN.

Room state is read from the database for each request. These content queries have no independent application result cache; next-request queries reflect committed changes without a restart or rebuilding activity data.

## Frontend handoff

HODL-78 should render the returned operationStatus, use the admin endpoints above, preserve filters/page in navigation, show CLOSE room guidance on direct links, and handle `403 + ROOM_CLOSED` from content APIs. A client-side ETH allowlist is unnecessary: administrators can open any room. No frontend files are changed here.
