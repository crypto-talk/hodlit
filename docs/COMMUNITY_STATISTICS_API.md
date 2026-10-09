# Community activity statistics (HODL-44)

Public endpoints:

- `GET /api/v1/communities/stats?window=24h`
- `GET /api/v1/communities/{symbol}/stats?window=24h`
- `window=all` returns cumulative activity; the default is `24h`. Other windows return 400. Symbols are case-insensitive; missing/inactive rooms return 404.

Response: `{window, from, until, rooms:[{symbol, postCount, commentCount, viewCount, likeCount, participantCount, verifiedParticipantCount, verifiedParticipantRate}]}`. All active rooms appear, including empty ones. Empty denominators produce a verification rate of 0. Rate is percent, from 0 to 100.

## Definitions

- Rolling window is `[from, until)` in UTC instants, not a calendar day. Recent means the last 24 hours.
- Posts: existing posts created during the window.
- Comments: existing comments created during the window, even on an older post.
- Likes: currently retained likes created during the window; unlikes remove the record.
- Views: successful backend post-detail GET requests, including anonymous/repeated requests. Lists and feeds do not increment views. These are request counts, not unique visitors; cached responses not reaching the backend are not counted. Collection starts with this migration; historical views are not invented.
- Participants: distinct logged-in member IDs appearing in posts, comments, likes or detail views during the window. A member appears once across activity types; anonymous views do not add participants.
- Verified participants: participants with a positive verified snapshot for that coin captured within the last hour and at least one currently connected wallet. This is current recorded verification, not a claim of a historical on-chain check for every activity.
- Deleting content cascades its likes/comments/views; the statistics count retained content, not an append-only audit ledger. Post deletion can reduce cumulative statistics.

A single set-based SQL query aggregates all rooms; no full entities or per-room query loop is used. Native SQL is required for the UNION across activity types. Supporting activity-time indexes and `post_view_events` are added by `011-community-activity.sql`. View events have no wallet address, IP address, token or other identifier beyond optional member ID.

The existing `/communities/{symbol}` postCount is fixed to a database COUNT rather than a list truncated at 100. It stays a cumulative count, independent of the rolling statistics endpoint.

## Frontend handoff

Use `24h` data to select '지금 뜨는 방'. Ranking weights are intentionally not prescribed. Replace fixed member/verification statistics with participantCount/verifiedParticipantRate where the label reflects their defined meanings. Distinguish retained cumulative counts from the last-24-hours activity. No frontend files changed in this branch.

Other independent develop-based branches may add migration 011 with a different descriptive filename/changeset ID; preserve all includes during integration. Do not rename or rewrite a migration after application. View-event retention/abuse controls should be considered before a large public rollout; no unique-visitor or bot-filter claim is made here.
