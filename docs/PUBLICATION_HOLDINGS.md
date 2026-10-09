# Server-side publication holdings (HODL-45)

Post and comment creation refresh supported holdings on the server, even if the client never calls `/me/assets`. Unsupported communities do not trigger balance RPC calls. No connected wallets means no publication holding snapshot is trusted.

Defaults (Spring properties, ISO-8601 duration):

- `cryptalk.asset.publication-max-age=PT1H`: only cached snapshots captured within the last hour may remain verified after a refresh failure. Future timestamps are not trusted.
- `cryptalk.asset.publication-refresh-budget=PT3S`: total budget for sequential balance RPCs, divided into remaining connect/read timeouts. The existing market-price request and database work are separate; this is not a 3-second end-to-end publication deadline. Standard socket read timeout is an inactivity bound, not a defense against a malicious trickle-response provider.

Balance/price provider HTTP 503 errors do not block publication. Other API errors (e.g. invalid member) are not hidden. If refresh fails and a recent cache exists, its detached publication copy uses `syncStatus=CACHED`; after expiration it uses `STALE`, clears verified status, quantity band and exact publication quantity. Missing cached data remains `NO_DATA`. Successful refresh uses `READY`. Existing cached records and previously published snapshots are not rewritten by fallback handling.

## Frontend handoff

After this branch is integrated, remove client-side `refreshHoldings()` calls before post/comment creation and `PostDraft.verifiable` when it is no longer used. Display `CACHED`/`STALE` as last-known/not-current verification if useful; do not imply that stale records prove ownership. No exact quantities are added to public responses. Regenerate OpenAPI types if necessary; response fields are unchanged, but syncStatus gains these values.

HODL-48 cache deletion is a separate branch based on develop. Both branches modify `AssetService`: integrate the no-wallet cache deletion from HODL-48 and the write-transaction refresh/freshness logic here, rather than reverting either. HODL-47 RPC diagnostics also touches EthereumBalanceClient; retain diagnostics when integrating the timeout-aware overload.

Tests cover direct server publication, refreshed zero balance on later comments, immutable earlier post snapshots, provider failure with/without cache, and expired-cache rejection.
