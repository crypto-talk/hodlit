# Backend PR integration — 2026-10-11

Integrates PRs #35–#47 into one tested change for develop, preserving every source PR head in merge ancestry. No frontend changes or production credentials are included.

- One AssetService combines wallet/exchange aggregation, server publication refresh, EVM time budgets, partial-failure handling and cache invalidation. Failed sources are UNKNOWN/PARTIAL; old cache data cannot restore an unchecked verified total. Price failure hides valuation without negating successfully checked ownership.
- Wallet fetching now uses one AlchemyPortfolioClient with safe provider diagnostics. Direct ETH/POL RPC clients were removed in the subsequent Alchemy-only cleanup. The wallet budget does not promise a total publication or exchange deadline.
- Holder status is derived once from source-aware asset data and persisted in immutable post/comment holder rows. Exchange-only HOLDER must not become NOT_CONNECTED. A shared HoldingQuantityBand produces the same coarse ranges everywhere.
- News and polls share one AdminAccess implementation, one allowlist configuration and one Compose environment entry. Poll and statistics clocks use explicit bean qualifiers.
- Global/room search use one query/mapper with optional room scope. News, search and numbered lists share PageResponse without changing their JSON field names. Private endpoints remain authenticated.
- Numbered feed/list reads use read-only mapping, never the detail-view event path. Hot-room scoring excludes reads and verification; current verification statistics include confirmed exchange-only holders.
- Every distinct Liquibase include is preserved. Descriptive 011 changesets are distinct and are not renamed or rewritten; 012-exchange-account-identity.sql remains intact. No duplicate column migration is introduced.

Operational prerequisites: set members.role to ADMIN for approved service administrators (see ADMIN_PERMISSIONS.md); Upbit needs main-pocket asset/pocket permissions and Bithumb needs an API 1.0 info/balance key. Unconfirmed legacy exchange connections require reconnect/disconnect before verified use. Coinone account-ID uniqueness remains TODO by explicit user scope. Regenerate frontend API types after deployment for new endpoints/fields and shared schema names.
