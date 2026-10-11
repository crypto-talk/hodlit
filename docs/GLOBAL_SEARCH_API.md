# Global search (HODL-65)

`GET /api/v1/search?q=검색어&page=0&size=20` is public. Search text is stripped, 1..100 characters; size is 1..100, page is nonnegative with a bounded integer offset. Invalid requests return 400. Empty/out-of-range results return 200 with accurate totals.

Response: `{items, page, size, totalElements, totalPages, hasNext, hasPrevious}`. Items: `{type, id, label, excerpt, authorNickname, roomSymbol, postId, createdAt, relevance}`. `type` is POST, COMMENT, ROOM or USER. Use `(type,id)` as the UI key, not ID alone. Room timestamps and unrelated fields can be null; excerpts are plain text capped at 200 Unicode code points, not HTML.

Field mapping and relevance (summed per matched field):

- POST: title=3, body=1, author nickname=2.
- COMMENT: body=1, author nickname=2; parent title is a display label, not a searchable comment title.
- ROOM: active coin name/symbol matches score 3 (one logical name field).
- USER: public nickname matches score 2. Login ID/email, password, wallets, keys, amounts and private drafts are never queried or returned.

Case-insensitive contains matching of the entire search string. `%`, `_`, `!` and quotes are literal characters, not wildcards/SQL. Tie order: score DESC, creation time DESC (null room times last), type ASC, ID DESC. Active-room restriction applies to posts/comments/rooms; public users remain searchable independently.

Frontend: retain q/page/size in URL state; reset page on text changes; show 1-based page buttons from totalPages; link POST to its room/post, COMMENT to its post and comment anchor, ROOM by roomSymbol, USER by public member ID. Run pnpm gen:api after deployment. No UI is changed here.

Set-based UNION query and a count query replace loading all entities to rank in memory. Contains matching necessarily scans text; large-scale indexing/FTS is future optimization, not a claim of production load testing. HODL-69 provides the independent room-scoped variant. Numbered paging uses the same metadata contract as HODL-66 without requiring that branch to be merged first.
