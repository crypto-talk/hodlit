# Holding cache invalidation (HODL-48)

Disconnecting an owned wallet through `DELETE /api/v1/me/wallets/{id}` deletes the member's cached `AssetSnapshot` records in the same transaction. This happens even when another wallet remains: the previous aggregate included the removed wallet and must not be reused. Unauthorized disconnect attempts leave both wallets and caches unchanged.

`GET /api/v1/me/assets` with no wallets **and no exchanges** clears stale cached holdings and returns an empty portfolio. Exchange-only accounts retain valid live exchange verification. Publication refuses cached proof when no eligible verification source remains.

Published post/comment holder snapshots are stored independently and are not modified or deleted. Their historical display remains immutable. This change adds no public response fields or database migration.

Frontend handoff: invalidate wallet and current-asset queries after disconnect. Newly published posts/comments must not be shown as current holders using an old client cache. Integrated HODL-45/50 refreshes remaining wallets and exchanges on publication; a disconnected wallet cannot erase a fresh exchange-only holder claim. The private aggregate is invalidated on either wallet or exchange removal, then rebuilt from the remaining sources. Published historical rows are untouched.
