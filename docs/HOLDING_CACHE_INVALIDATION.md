# Holding cache invalidation (HODL-48)

Disconnecting an owned wallet through `DELETE /api/v1/me/wallets/{id}` deletes the member's cached `AssetSnapshot` records in the same transaction. This happens even when another wallet remains: the previous aggregate included the removed wallet and must not be reused. Unauthorized disconnect attempts leave both wallets and caches unchanged.

`GET /api/v1/me/assets` with no wallets also clears stale cached holdings and returns an empty portfolio. Publication refuses a cached snapshot if the member currently has no connected wallets, including legacy stale records created before this fix.

Published post/comment holder snapshots are stored independently and are not modified or deleted. Their historical display remains immutable. This change adds no public response fields or database migration.

Frontend handoff: invalidate wallet and current-asset queries after disconnect. Newly published posts/comments must not be shown as current wallet holders using an old client cache. While another wallet remains, refresh `/me/assets` before relying on aggregate balances. Server-side refresh/freshness is separately tracked in HODL-45. Exchange-backed holdings are not currently part of this cache; integration in HODL-50 must make cache invalidation source-aware.
