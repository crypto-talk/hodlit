# Admin room news (HODL-62)

## API

- Public GET `/api/v1/communities/{symbol}/news?page=0&size=20`: newest creation time/ID first. Same numbered metadata as HODL-66; max size 100, unknown/inactive room 404, invalid bounds 400.
- Admin POST `/api/v1/communities/{symbol}/news`: 201.
- Admin PUT `/api/v1/news/{newsId}`: full update, 200.
- Admin DELETE `/api/v1/news/{newsId}`: 204.

POST/PUT body: `{title,summary,sourceName,sourceUrl}`. Required nonblank lengths 200/1000/100/1000. Source URL must be absolute HTTP(S), no URL credentials. These are plain-text fields: this service never fetches source URLs, imports RSS, auto-posts news or provides article full text. Response adds id/coinSymbol/createdAt/updatedAt.

Admin IDs are deployment-controlled `ADMIN_MEMBER_IDS=1,2` (real persisted member IDs, not Jira account IDs). Default empty denies **everyone**. Allowlist + existing member + validated JWT subject is checked in the service; body IDs, headers and JWT roles supplied by the client cannot grant access. Missing auth is 401, authenticated nonadmin 403. Compose now passes this value from its environment; `.env.example` documents an empty default. Operations must provision real approved IDs; no actual `.env` or production configuration was changed here. HODL-64 introduces the identical AdminAccess helper/config—retain one identical copy when integrating.

Frontend: show only title, short summary and a clearly labelled source link in its coin room; render plain text and external links with `rel="noopener noreferrer"`. Default 20 numbered pages. Provide admin tools only to approved administrators, but rely on API 403 rather than UI hiding as security. Refresh after mutation, run pnpm gen:api after deployment. There is no public admin-ID discovery API.

Migration: `011-community-news.sql`; coin deletion cascades its news. No existing changeset rewritten. UI and production admin provisioning are still required.

## Supplier comparison and recommendation (checked 2026-10-09)

Public official pages were fetched for this research; availability is not a grant of publication rights. Prices/terms can change and must be checked before purchase/automated integration.

| Candidate | Rights / attribution | Cost / rate limits | Language / fit |
| --- | --- | --- | --- |
| NewsAPI | Its terms explicitly retain third-party rights, forbid removing copyright/source/author notices, and do not grant rights to all aggregated articles. Original source credit/link required; check article owner permissions. | Official pricing: Developer $0, 100 requests/day, delayed articles, **development/testing only, not staging/production**. Business $449/month billed monthly, 250,000 requests/month, extra $0.0018/request. | `/everything` supported language codes include English and Chinese but **not ko**. Broad general news needs coin filtering and editorial review. High recurring cost for an initial manual-registration feature. |
| Cointelegraph RSS | Public RSS exists, but RSS availability does not establish redistribution or summary/title licensing. Obtain/check publisher permission/terms; preserve publisher/author/source link as required. Do not copy full article bodies. | RSS endpoint fetched successfully without a paid API key; no published numeric request quota/licence price was verified. No polling frequency promised. | English crypto-specific items observed, good editorial discovery source. Other language/feed rights not verified. Suitable for an administrator's manual source discovery, not automatic publication by default. |
| CryptoPanic | Aggregator; downstream publisher rights and attribution still need review. Licensing must be confirmed with vendor/publishers. | Official developer URL fetched, but client-rendered content did not expose current pricing/quotas to this audit. Marked **unverified**, not assumed free/unlimited. | Crypto focus; language coverage/ko and commercial permissions not verified. Defer purchase/integration until written current plan and rights confirmation. |

Sources:
- https://newsapi.org/pricing
- https://newsapi.org/terms
- https://newsapi.org/docs/endpoints/everything
- https://cointelegraph.com/rss
- https://cryptopanic.com/developers/api/

The attempted Cointelegraph `/rss-feeds` URL returned 404; use the verified `/rss` endpoint. A CoinDesk terms URL returned a 404 page despite HTTP 200, so no claim about its current licence was inferred.

**Recommendation:** launch manual administrator registration with original, short editorial summaries and verified original-source links; use Cointelegraph RSS only for administrator discovery subject to rights checks. Include Korean sources only after checking their current publisher terms directly; none were misrepresented as a confirmed licensed API. Do not buy NewsAPI's commercial plan for this initial requirement, use its free plan only in a development environment if evaluated later, and do not auto-ingest/repost any provider. This preserves the confirmed administrator-only publication model and avoids unverified licence/cost commitments. Any later automation requires a separate explicit decision and licence review.

## Skill publisher API

`POST /api/v1/news-publisher/communities/{symbol}/news` accepts the same
`{title,summary,sourceName,sourceUrl}` JSON and returns the same news response (201).
Send the dedicated password in `X-News-Publisher-Token` over HTTPS. This exact
POST route uses its own security chain without JWT processing, including when a
stale Authorization header is present. The password grants only news creation;
existing admin creation, updates, deletion and other APIs still require their
existing JWT/admin checks. Unknown/inactive rooms return 404; closed rooms return
403 (`ROOM_CLOSED`). Payload and source URL validation remain the same (400).

Set `NEWS_PUBLISHER_TOKEN` in the backend deployment environment. It must be at
least 32 UTF-8 bytes; a nonempty shorter value prevents startup. Empty/unset disables
publication. Missing, wrong and disabled credentials all return 401 with the common
error body. The password is compared using fixed-length SHA-256 digests and a
constant-time comparison. No database migration or administrator member is needed.

Generate a password with Python `secrets.token_urlsafe(48)` and store it in a
private secret file/secret manager, never in Git, the skill text, CLI arguments or
article JSON. Give the skill runtime the same value as
`HODLIT_NEWS_PUBLISHER_TOKEN`. Rotation means replacing the server environment
value, restarting the backend, and updating the client's secret. Do not send the
password in a URL. Clients should retain duplicate checks and persistent journals:
this API does not add atomic deduplication or automatic retries.
