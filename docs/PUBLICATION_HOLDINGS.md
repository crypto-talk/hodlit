# Server-side publication holdings (HODL-45)

Post and comment creation refresh supported holdings on the server, even if the client never calls `/me/assets`. An unsupported community with no connected exchange does not trigger wallet provider calls; an exchange refresh may discover currency support. No connected eligible wallets or exchanges means no publication holding snapshot is trusted.

Defaults (Spring properties, ISO-8601 duration):

- `cryptalk.asset.publication-max-age=PT1H`: only snapshots captured within the last hour can supply historical cached quantities after an exceptional refresh failure; these copies remain unverified. Future timestamps are not trusted.
- `cryptalk.asset.publication-refresh-budget=PT3S`: total budget for Alchemy wallet portfolio pages, divided into remaining connect/read timeouts. The existing market-price request and database work are separate; this is not a 3-second end-to-end publication deadline. Standard socket read timeout is an inactivity bound, not a defense against a malicious trickle-response provider.

The integrated HODL-49/50 source refresh records incomplete results as UNKNOWN/PARTIAL rather than reusing an older verified aggregate. Provider failures do not block publication, but never certify an unchecked total or EMPTY. On an exceptional 503 before a refreshed record can be saved, a detached recent cache copy may use CACHED for historical data; it is unverified with holderStatus=UNKNOWN. After expiration it uses STALE and clears verified status, quantity band and exact publication quantity. A fully successful refresh uses READY; pricing failure alone uses PRICE_UNAVAILABLE while retaining proven ownership and hiding valuation. Detached copies preserve wallet/exchange source counts and verification levels. Previously published snapshots remain immutable.

## Frontend handoff

After this branch is integrated, remove client-side `refreshHoldings()` calls before post/comment creation and `PostDraft.verifiable` when it is no longer used. Display `CACHED`/`STALE` as last-known/not-current verification if useful; do not imply that stale records prove ownership. No exact quantities are added to public responses. Regenerate OpenAPI types if necessary; response fields are unchanged, but syncStatus gains these values.

The integration uses one AssetService for wallet/exchange refresh, partial-failure status, cache invalidation and publication freshness. Wallet reads use AlchemyPortfolioClient exclusively with the shared publication refresh budget. Missing configuration or provider failure cannot revive cached holder proof. The wallet budget does not bound exchange HTTP calls or total publication latency.

Tests cover direct server publication, refreshed zero balance on later comments, immutable earlier post snapshots, provider failure with/without cache, and expired-cache rejection.
