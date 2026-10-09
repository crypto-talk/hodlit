# Room search (HODL-69)

Public `GET /api/v1/communities/{symbol}/search?q=...&page=0&size=20`, case-insensitive active symbol. Searches only POST and COMMENT in the specified room. Missing/inactive room is 404; blank/over-100-character q, negative page or size outside 1..100 is 400. Empty/out-of-range results are 200.

Metadata matches HODL-66: `{items,page,size,totalElements,totalPages,hasNext,hasPrevious}`. Item fields match HODL-65: `{type,id,label,excerpt,authorNickname,roomSymbol,postId,createdAt,relevance}`; use type+id keys. Excerpt is plain text capped at 200 Unicode code points. Comment label is the parent's title for display, not an extra searchable title.

Entire-query, case-insensitive substring matching. Post title/body/author nickname score 3/1/2; comment body/author nickname score 1/2. Matched-field weights are summed. Ties sort creation time DESC, type ASC, ID DESC. Bound SQL with literal wildcard escaping avoids SQL injection and wildcard expansion. No drafts/login IDs/addresses/assets/credentials are selected.

Frontend: keep current symbol/q/page/size in URL navigation, reset page for a new room/query, show page+1 buttons, link comment results to postId/comment id. pnpm gen:api after integration/deployment. This branch is independent origin/develop, no dependency on global search or numbered paging branches. Keep all three endpoints/contracts when merging; align Swagger operation totals. Frontend UI and production load testing are not part of this backend branch.
