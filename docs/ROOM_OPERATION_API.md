# Room operation status (HODL-77)

Room operation uses `operationStatus: OPEN | CLOSE`, independently of the coin catalog's `active` flag. Liquibase `014-room-operation-status.sql` initializes ETH as OPEN and all other existing rooms as CLOSE. New coins default to CLOSE until a service administrator opens them. The database constrains the allowed values.

## Service administrator endpoints

The existing `AdminAccess` allowlist (`ADMIN_MEMBER_IDS`) and validated JWT identify service-wide administrators. There are no room-specific administrators, assignments, or permissions.

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
- Admin news/poll preparation and management remain available through their existing admin checks even while a room is closed. Public viewing and voting resume after OPEN.

Room state is read from the database for each request. These content queries have no independent application result cache; next-request queries reflect committed changes without a restart or rebuilding activity data.

## Frontend handoff

HODL-78 should render the returned operationStatus, use the admin endpoints above, preserve filters/page in navigation, show CLOSE room guidance on direct links, and handle `403 + ROOM_CLOSED` from content APIs. A client-side ETH allowlist is unnecessary: administrators can open any room. No frontend files are changed here.
