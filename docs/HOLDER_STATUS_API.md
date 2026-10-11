# Explicit holder status (HODL-49)

Post and comment `holderSnapshot` responses gain `holderStatus`:

| Value | Meaning |
| --- | --- |
| HOLDER | All connected verification sources were checked successfully; aggregate quantity is positive. |
| EMPTY | All connected verification sources were checked successfully; aggregate quantity is zero. |
| UNKNOWN | A connected source failed, there is no checked snapshot yet, or publication falls back to stale/cached verification. |
| NOT_CONNECTED | No verification source is connected at publication. |

`verificationAvailability` remains separate; do not display a holding status for unsupported/not-configured coins. Integrated HODL-50 supports Ethereum ETH and Polygon PoS POL wallet balances and matching exchange currencies, including exchange-only BTC/ETH. Source counts must include exchanges when deriving NOT_CONNECTED.

`GET /me/assets` no longer discards the entire refresh on one wallet failure. Successful wallets contribute their known quantities; failed wallets are not assumed empty. The result is HTTP 200 with `status=UNKNOWN`, `verified=false`, `syncStatus=PARTIAL` when incomplete. A successful zero balance is `VERIFIED`, not an error. In the integrated source-aware implementation, price-provider failure alone does not negate successfully verified ownership: syncStatus=PRICE_UNAVAILABLE and private valueKrw=null. Wallet/exchange balance failures remain UNKNOWN/PARTIAL. Invalid account and other non-provider errors still propagate. The private quantity is a **known subtotal**, not a verified total, whenever status is incomplete.

Public snapshots store the status independently and remain immutable. No exact quantity or wallet address is added to public post/comment DTOs. Migration `011-holder-status.sql` adds the status columns and conservatively classifies historical records; historical NO_DATA is UNKNOWN because it does not prove disconnection.

## Frontend handoff

After integration/deployment run `pnpm gen:api`. Replace walletCount-based EMPTY inference with holderStatus. UNKNOWN must never be rendered as 'ETH 미보유'. Use verificationAvailability first, then holderStatus. Treat PARTIAL private holdings as incomplete, not as a trustworthy total.

## Integration notes

This branch is independently based on develop. Preserve HODL-45's server refresh and deadline/freshness logic while integrating the partial-success loop here. When a refresh produces an UNKNOWN partial record, do not reuse an older verified aggregate. Cached/stale publication copies must be UNKNOWN even if an independent cached-verification policy still exposes historical verifiedHolder. Preserve HODL-48's disconnect/empty-wallet cache invalidation. Those branches touch the same AssetService/AssetSnapshot code and require a deliberate merge; none is silently stacked or merged to develop.
