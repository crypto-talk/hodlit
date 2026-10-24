# Community activity statistics (HODL-44)

Public endpoints:

- `GET /api/v1/communities/stats?window=24h`
- `GET /api/v1/communities/{symbol}/stats?window=24h`
- `window=all` returns cumulative activity; the default is `24h`. Other windows return 400. Symbols are case-insensitive; missing/inactive rooms return 404.

Response: `{window, from, until, rooms:[{symbol, postCount, commentCount, viewCount, likeCount, participantCount, verifiedParticipantCount, verifiedParticipantRate, hotScore, activeParticipantCount, lastActivityAt}]}`. Empty denominators produce a verification rate of 0. Rate is percent, from 0 to 100.

The global default `GET /api/v1/communities/stats?window=24h` is the **지금 뜨는 방** list: it excludes rooms with no recent qualifying activity and sorts by the ranking below. If none qualify, `rooms` is empty (HTTP 200); it does not fill slots with inactive/empty/view-only rooms. The individual-room endpoint still returns an active empty room with zero metrics. `window=all` still returns all active rooms, including empty ones, in the existing display order. The legacy statistic fields retain their definitions.

## Definitions

- Rolling window is `[from, until)` in UTC instants, not a calendar day. Recent means the last 24 hours.
- Posts: existing posts created during the window.
- Comments: existing comments created during the window, even on an older post.
- Likes: currently retained likes created during the window; unlikes remove the record.
- Views: successful backend post-detail GET requests, including anonymous/repeated requests. Lists and feeds do not increment views. These are request counts, not unique visitors; cached responses not reaching the backend are not counted. Collection starts with this migration; historical views are not invented.
- Participants: distinct logged-in member IDs appearing in posts, comments, likes or detail views during the window. A member appears once across activity types; anonymous views do not add participants.
- Verified participants: participants with a positive verified snapshot for that coin captured within the last hour and a currently connected verification source. Exchange-only holders are included; Upbit/Bithumb connections must have a confirmed account fingerprint, while Coinone retains the explicitly deferred identity policy. This is current recorded verification, not a claim of a historical source check for every activity. Verification never changes hotScore.
- Deleting content cascades its likes/comments/views; the statistics count retained content, not an append-only audit ledger. Post deletion can reduce cumulative statistics.

## Hot-room ranking (approved 2026-10-11)

Only retained **posts, comments and likes** are ranking activities. Detailed reads, anonymous views and verification status/rate add no points. A recent comment/like on an old post qualifies by its own creation time. Editing a post/comment is not a new activity. Activity is grouped by `(room, member)`; each member contributes once per room, according to their latest qualifying activity in `[until - 24h, until)`.

| Latest activity | Points for that member |
| --- | --- |
| `[until - 1h, until)` | 3 |
| `[until - 6h, until - 1h)` | 2 |
| `[until - 24h, until - 6h)` | 1 |

`hotScore` is the sum of these mutually exclusive member contributions. `activeParticipantCount` is the number of these distinct contributing members. `lastActivityAt` is their latest qualifying activity across the room; absent/null when no one qualifies. These three ranking fields **always describe the last 24 hours**, even alongside `window=all` cumulative legacy metrics.

One member posting 100 times and liking/commenting still contributes at most 3 points. The same member can contribute separately to different rooms. A room with two people active in the last hour scores 6; a room with three people active 8 hours ago scores 3. Likes removed or content deleted cease contributing; the remaining last activity is used. This is a rolling activity ranking, not a growth-rate comparison against yesterday.

The global 24h list sorts by:

1. `hotScore DESC`
2. `activeParticipantCount DESC`
3. `lastActivityAt DESC`
4. Existing room display order ASC, then room ID ASC for stable ties.

Example room item:
```json
{
  "symbol": "ETH",
  "postCount": 2,
  "commentCount": 3,
  "viewCount": 50,
  "likeCount": 4,
  "participantCount": 12,
  "verifiedParticipantCount": 3,
  "verifiedParticipantRate": 25.0,
  "hotScore": 5,
  "activeParticipantCount": 2,
  "lastActivityAt": "2026-10-11T05:50:00Z"
}
```
In this example the 12 participants include read-only members, while only 2 members contributed posts/comments/likes. One contributed 3 points and the other 2. Counts and verification data cannot boost this score independently.

A single set-based SQL query aggregates statistics and per-member latest activities for all rooms; no full entities or per-room query loop is used. Native SQL is required for the UNION across activity types. One UTC clock instant supplies all time boundaries in a request. Supporting activity-time indexes and `post_view_events` are added by `011-community-activity.sql`; ranking needs no additional schema change. View events have no wallet address, IP address, token or other identifier beyond optional member ID.

The existing `/communities/{symbol}` postCount is fixed to a database COUNT rather than a list truncated at 100. It stays a cumulative count, independent of the rolling statistics endpoint.

## Frontend handoff

Use the already-ranked global `24h` response for '지금 뜨는 방', taking the desired first N rooms without re-sorting on counts/views/verification. An empty list means no qualifying rooms, not an error. Use `activeParticipantCount` for a contributing-member label; `participantCount` includes logged-in viewers. Replace fixed verification statistics with verifiedParticipantRate where its definition is appropriate. Distinguish retained cumulative counts from the last-24-hours activity. `window=all` is for cumulative statistics, not the hot list. Regenerate OpenAPI types after integration/deployment for the three new fields. No frontend files changed in this branch.

Other independent develop-based branches may add migration 011 with a different descriptive filename/changeset ID; preserve all includes during integration. Do not rename or rewrite a migration after application. View-event retention/abuse controls should be considered before a large public rollout; no unique-visitor or bot-filter claim is made here.
