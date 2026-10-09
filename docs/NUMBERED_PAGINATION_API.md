# Numbered list pagination (HODL-66)

New endpoints preserve the legacy array/cursor contracts:

| GET endpoint | Scope |
| --- | --- |
| `/api/v1/posts/page` | All canonical posts in active rooms (not repost activity events) |
| `/api/v1/communities/{symbol}/posts/page` | One active room, case-insensitive symbol |
| `/api/v1/posts/{postId}/comments/page` | A post's comments |
| `/api/v1/coins/page` | Active room list |
| `/api/v1/me/bookmarks/page` | JWT member's bookmarks (authenticated) |
| `/api/v1/me/wallets/page` | JWT member's wallets (authenticated) |
| `/api/v1/me/exchanges/page` | JWT member's exchange connection metadata (authenticated; no credentials) |
| `/api/v1/members/{memberId}/followers/page` | Public followers |
| `/api/v1/members/{memberId}/following/page` | Public following members |

All accept `page=0` and `size=20` defaults. Page numbering is zero-based on the API; UI page buttons show `page+1`. Size must be 1..100, page nonnegative and offset within JPA's integer limit, otherwise HTTP 400.

Response: `{items, page, size, totalElements, totalPages, hasNext, hasPrevious}`. Empty/out-of-range pages return HTTP 200 with empty items and truthful totals; unknown/inactive rooms and missing posts return 404. Private metadata retains original ownership boundaries and never accepts an actor ID parameter.

Post pages sort creation time DESC, then ID DESC. Comment pages sort creation time ASC, then ID ASC. Room pages use display order ASC then ID ASC; other lists have explicit stable time/entity tie-breakers. Post pages accept `verified=true` to filter server-side before counting/page selection.

No drafts endpoint was added. Existing `/feed` and `/feed/following` activity feeds retain cursor pagination; canonical post pages are the new source for numbered whole-post lists and do not pretend repost events are independent posts. Search result pagination is implemented in its own HODL-65/69 branches.

Frontend handoff: switch target list requests to these paths, preserve room/verified/search/URL state on page navigation, reset page to 0 when a filter changes, and render buttons from totalPages. Run `pnpm gen:api` after integration/deployment. No frontend files are changed here. Grouping replies on comment pages must account for a root potentially being on another page (HODL-60); do not infer a third nesting level.

No schema migration. Other independent issue branches extend PostService, CommentService, WalletService and ExchangeConnectionService; keep their business changes while combining these read-only page methods. Swagger endpoint-count regression tests must count all integrated additions, not replace one branch's additions with another's.
