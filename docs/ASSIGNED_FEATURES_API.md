# Assigned feature implementation

This change extends the current main branch. Existing public profile APIs (HODL-75) and room operation APIs (HODL-77) are reused rather than duplicated. Backend changes remain on a feature branch; merging and deployment are separate actions.

## Issue map

| Issue | Implementation |
| --- | --- |
| HODL-75 | `/@nickname` public profile, activity pages, author links, own-profile link, coin-specific profile visibility |
| HODL-76 | Existing room operation API; public closed-room guidance, closed-room discovery labels and write-room filtering; administrator room screen |
| HODL-79 / HODL-80 / HODL-82 | Versioned room badge settings, immutable post/comment badge capture, admin settings and previews, public badge rendering |
| HODL-85 | Post hide/restore, member suspend/resume, administrator screens and moderation logs; reuse room operations |
| HODL-91 | Administrator banner CRUD/reorder and public visible banner lookup |
| HODL-94 / HODL-96 | One draw per member per event, persisted immutable outcome and administrator event/prize settings |
| HODL-99 | Grouped search previews and independent category pagination, with legacy mixed search preserved |
| HODL-101 | Room creation, metadata editing, soft deletion and category CRUD |

HODL-92 (banner screens), HODL-95 (draw screens), HODL-100 (grouped search screens) remain separate frontend tasks assigned to the other developer. Their API contracts are supplied here; existing search calls continue to work without a coordinated breaking deployment.

## Banners (HODL-91)

Administrator base: `/api/v1/admin/banners`. All operations require an authenticated service administrator.

| Method | Path | Body |
| --- | --- | --- |
| GET | base | None |
| GET | `/{id}` | None |
| POST | base | Complete banner fields below; returns 201 |
| PATCH | `/{id}` | Complete replacement of editable fields |
| DELETE | `/{id}` | None; returns 204 |
| PATCH | `/order` | `{"ids":[3,1,2]}`; all current IDs once each |

Editable fields:

```json
{
  "title": "ETH launch",
  "imageUrl": "/api/v1/media/<uploaded-uuid>.png",
  "altText": "ETH community launch announcement",
  "linkUrl": "/subhodl/ETH",
  "visible": true,
  "displayOrder": 0
}
```

Title is 1–100 chars, alt text 1–200, URLs up to 1000, order nonnegative. Link is nullable/empty, a same-site absolute path, or an HTTP(S) URL without user credentials. Protocol-relative links, executable schemes, control characters and backslashes are rejected.

Upload images through existing `POST /api/v1/media` multipart `file`. Existing limits apply (25 MiB; JPEG/PNG/WebP/GIF for banners). The image must have a stored upload record belonging to the acting administrator, and must not be attached to a post or draft. Publication, draft and media mutations also use READ_COMMITTED and check references after locking the media row. Banner references protect managed media from direct deletion, post claims and draft claims. Deleting a banner does not delete an image used elsewhere.

`GET /api/v1/banners` is public and returns only visible banners ordered by displayOrder then ID, with id/imageUrl/altText/linkUrl/displayOrder. No banner result cache is introduced. Admin responses additionally carry title, visibility and creation/update timestamps. For browser image sources prepend the configured backend origin to managed relative URLs.

## Draw events (HODL-94, HODL-96)

Public `GET /api/v1/draw-events/{id}` returns a previously activated event, public prize descriptions and `canParticipate`. Drafts return 404. Prize weights are never returned publicly.

Authenticated endpoints:

- `POST /api/v1/draw-events/{id}/draw`: atomically chooses and stores a prize, or returns the member's previous result. It accepts no user/prize selection input. A first result has `existing:false`; all later requests return the same id/prize snapshot with `existing:true`.
- `GET /api/v1/draw-events/{id}/me`: `{result:...}` when participated; result is absent/null when not participated (global non-null serialization may omit it).

Result fields: id, eventId, prizeId, prizeName, imageUrl, capturedAt, existing. The result records acquisition only. There is no payment, inventory reservation, delivery, coupon issuance or points integration.

Admin base: `/api/v1/admin/draw-events`:

| Method | Path | Contract |
| --- | --- | --- |
| GET | base | page=0,size=20 numbered listing |
| GET | `/{id}` | Full settings including weights |
| POST | base | title (1–100), description (0–2000), startsAt, endsAt |
| PATCH | `/{id}` | Same event fields, editable draft only |
| PUT | `/{id}/prizes` | `{"prizes":[{"name":"Gift","imageUrl":"https://example.com/gift.png","description":"Details","weight":1,"displayOrder":0}]}` |
| PATCH | `/{id}/status` | `{"status":"ACTIVE"}` or `PAUSED` |

Timestamp values include UTC/offset. New/edited draft starts must be in the future and before the end. Configure and activate before the event starts. Once published, configuration is frozen; pause/resume remains available until the end. Resume does not reset participation. Prize weights are positive 64-bit integers with overflow-checked sum, 1–100 prizes, distinct names. Each prize probability is weight/sum. Images are HTTPS URLs or existing unused managed images owned by the acting administrator. Managed images referenced by prize configurations or recorded outcomes cannot be deleted or claimed by posts/drafts.

Draw/configuration writes explicitly use READ_COMMITTED, so a transaction that waits for a lock observes outcomes/settings committed by the previous holder even when the MySQL datasource default is REPEATABLE_READ. An event-row pessimistic lock serializes configuration changes, pauses and draws across application instances. The database additionally enforces unique(event_id,member_id). The locked transaction checks existing results before availability so retries after pause/end still recover the original outcome. Selection uses SecureRandom and stores immutable name/image snapshots in the same transaction. Invalid/unavailable events return 409 without consuming participation. Nonexistent resources return 404, invalid settings 400, unauthenticated requests 401, non-admin settings requests 403.

The event-level lock intentionally favors correctness over extreme throughput for this initial implementation. No application-memory-only participation guard is used.

## Grouped search (HODL-99)

Existing `/api/v1/search?q=...&page=0&size=20` and `/api/v1/communities/{symbol}/search` remain mixed numbered lists when no type is supplied.

Add `type=posts|comments|rooms|users` to query one category with independent page metadata. A room query only accepts posts/comments. Unknown types return 400.

New public previews:

- `GET /api/v1/search/groups?q=...&previewSize=5`
- `GET /api/v1/communities/{symbol}/search/groups?q=...&previewSize=5`

The response is `{posts:PageResponse,comments:PageResponse,rooms:PageResponse,users:PageResponse}`. Room search omits rooms/users. Each group has independent items/totalElements/totalPages/hasNext metadata, even when zero. Preview size is 1–100, default 5. More-results links call the original endpoint with the selected type and numbered page (default 20).

SearchItem preserves type/id/label/excerpt/authorNickname/roomSymbol/postId/createdAt/relevance. USER label is the current nickname, usable for `/@${encodeURIComponent(label)}`. COMMENT id is the anchor ID and postId identifies its original post; existing UI uses `#comment-{id}`. No private user fields are added. Ranking and literal escaped inclusion matching are unchanged within categories. Filters, including room state and moderated content, apply before counts and pagination.

## Badge settings (HODL-79, HODL-80, HODL-82)

- `GET /api/v1/admin/badge-presets`: allowed icon/color/effect keys.
- `GET /api/v1/admin/communities/{symbol}/badge-config`: symbol, version, ordered tiers.
- `PUT` same path: `{expectedVersion,tiers:[{name,minimumQuantity,icon,color,effect},...]}`.

Management UI: `/admin?tab=rooms`, select a room's 등급 설정. Tiers can be added, edited, reordered, removed and previewed in detail/list/comment sizes. Minimum values are sent as decimal strings, avoiding JavaScript floating-point conversion.

The first minimum is zero, only positive verified holdings receive a badge. Subsequent minima strictly increase. Each upper bound is the next minimum (exclusive), last is unbounded; no explicit overlapping/gapped upper bounds are accepted. Decimal precision is 18 integer + 18 fractional digits, max 20 tiers. Writes lock the room and compare expectedVersion, returning 409 for stale settings. Old versions are retained.

ETH starts with the Jira draft defaults as editable database data, not hardcoded calculation rules. Other rooms can be configured by the administrator. New publications capture the current setting into embedded immutable badge fields. Post updates, asset refresh and later setting changes never recalculate saved badges. Older publications retain their original quantity bands with no invented historical animal badge.

Public post/comment holderSnapshot adds optional `badge` with version/name/quantityBand/icon/color/effect. Comment publication now explicitly discloses the coarse configured tier through badge, while retaining no raw exact quantity. A partial positive verified subtotal can receive a tier; PARTIAL remains visible. NOT_CONNECTED/EMPTY display 미보유, UNKNOWN displays 조회 실패. Unsupported coins retain their existing unsupported notice. Reduced-motion disables animation; lists/comments use subdued static rendering. Frontend never calculates a tier from raw quantity.

Current asset/profile band display uses the current configuration where available. Historical publication bands always use captured configuration.

## Administrator moderation (HODL-85)

Management UI: `/admin?tab=posts|members|logs`. `GET /api/v1/admin/access` checks current DB role; there is no new client-side role source of truth.

- `GET /api/v1/admin/posts` or `/members`: q, optional state=true/false, page,size.
- `GET .../{id}`: administrator detail, including hidden post body.
- `PATCH .../{id}/status`: `{"enabled":true,"reason":"..."}`. For posts, enabled=true means hidden; for members, suspended. False restores/resumes. Reason is required, max 500 chars. UI confirms the action before sending.
- `GET /api/v1/admin/moderation-logs`: numbered history.

No permanent content/member deletion is introduced. Hidden posts are excluded from ORM public loads, raw SQL search/feed/statistics and public activity counts. Existing content and snapshots remain stored. A suspended member cannot obtain/refresh tokens; existing JWTs are checked against current DB suspension state on requests. Logout is permitted. Self-suspension and suspending another administrator are rejected, preserving administration access. Logs record actor/target, previous/new state, reason and timestamp in the mutation transaction.

## Room catalog/categories (HODL-101)

Existing `/api/v1/admin/communities` list/status endpoints are reused. Add:

- POST base: `{symbol,name,displayOrder,categoryId?}`. Symbol 2–20 ASCII letters/digits normalized uppercase; name 1–80; order nonnegative. New room is active but CLOSE with NOT_SUPPORTED verification, no inferred market/token configuration. Once opened, it supports posts without a price snapshot until a real market integration exists; no invented price is stored.
- PATCH `/{symbol}`: `{name,displayOrder,categoryId:null|id,active}`. Reactivating a removed room keeps it closed until an explicit status change.
- DELETE `/{symbol}`: soft-delete by active=false and CLOSE, preserving all content and preventing same-symbol recreation.
- GET/POST `/api/v1/admin/room-categories`; PATCH/DELETE `/{id}`. Body `{name,displayOrder}`. Single-level categories, a room has one category or none. Assigned categories cannot be deleted, including inactive rooms; move/unassign first (409 otherwise).
- Public GET `/api/v1/room-categories`; coin/community and administrator room responses add categoryId. Admin responses also add displayOrder.

Settings are transactional with DB foreign keys/uniqueness, and mutations appear in moderation history. Public endpoints continue excluding inactive rooms; content access/participation retains the existing RoomAccess guard.

## Public profile and privacy (HODL-75)

Nickname changes retain the current policy: only the current nickname resolves, with no historical nickname redirect. The profile route uses GET /api/v1/members/by-nickname?nickname=... so reserved URL characters in valid nicknames remain addressable; the existing /by-nickname/{nickname} endpoint remains supported. It consumes the existing nickname lookup and member post/comment page APIs. It renders only returned coarse holdings, captured activity snapshots and whole-month holding labels; no wallet addresses or exact asset quantity fields are used.

`GET /api/v1/me/asset-visibility` returns per-coin publication choices. `PUT /api/v1/me/asset-visibility/{symbol}` takes `{visible:boolean}`. The authenticated member is always derived from JWT. Profile assets and profile activity holder snapshots respect per-coin preferences, with the member-wide HIDDEN setting taking precedence. Choices can be edited in `/mypage/assets`. They do not rewrite the public snapshots already attached to a published post/comment.

## Migrations and verification

New Liquibase files 017–022 add banners, draw events/prizes/results, versioned badge settings and snapshot columns, moderation state/history, room categories and profile coin preferences. Existing applied changelogs are unchanged.

Tests include MockMvc endpoint contracts, authorization, category reference/soft-delete behavior, grouped counts/filtering, moderation visibility, configurable badge boundaries/version conflicts and concurrent draw requests using independent transactions.

`ContractExportApiTest` exports the implemented local `/v3/api-docs` to backend/build/openapi.json for frontend regeneration against this feature branch. Do not generate types against the old production API when reviewing this change.
