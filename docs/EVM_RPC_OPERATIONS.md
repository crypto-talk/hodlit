# EVM RPC diagnostics (HODL-47)

`ETHEREUM_RPC_URL` must name an Ethereum Mainnet JSON-RPC provider. An empty value intentionally disables verification; it does not mean a wallet has no ETH. A successful `0x0` result is a verified empty wallet, not an error.

## Deployment checks

1. Confirm the **running backend container** has a non-empty `ETHEREUM_RPC_URL`, without printing the value (provider URLs may contain credentials). Setting only the host shell does not update an existing container.
2. From the backend container's network, check provider DNS, HTTPS connectivity and `eth_getBalance` for a test wallet. Do not publish private wallet addresses or provider URLs in logs/Jira.
3. If the provider needs authentication, check its configuration and quota. A public Ethereum provider such as `https://ethereum-rpc.publicnode.com` may be used deliberately, subject to its availability and usage policy.
4. After an authorized deployment/configuration change, call `GET /api/v1/me/assets` with a test account containing an EVM wallet. A successful balance lookup, including zero, must return HTTP 200. Nonzero balances also need a working price provider.

## Safe log messages

- Missing configuration: explicit startup warning naming `ETHEREUM_RPC_URL`.
- HTTP failure: numeric HTTP status (e.g. 429).
- JSON-RPC failure: numeric RPC error code.
- Transport/parse failure: exception category, not raw message/stack/body/URL.

Raw exception text and response bodies can contain credentials or wallet addresses and are intentionally not logged. Failed RPC reads produce `RPC_ERROR` with `UNKNOWN/PARTIAL` in the private aggregate asset response (HTTP 200). A successful partial response is not proof that all sources were verified.

Unit tests cover successful zero/nonzero balances, malformed payloads, provider errors and missing configuration. Tests are not proof that production is correctly configured. Production `/me/assets` confirmation requires deployment access and a test account; do not close the operational incident based only on these tests.

## Polygon PoS native POL

The same connected EVM address is queried on Polygon PoS mainnet for its native POL balance, separately from Ethereum ETH. Polygon uses chain ID 137 and 18 decimal places. The client checks `eth_chainId` before `eth_getBalance`; a different chain, malformed response, missing configuration or upstream failure produces UNKNOWN/PARTIAL, never EMPTY. A successful zero balance is EMPTY. Ethereum and Polygon RPC failures are isolated per coin.

Docker Compose supplies `POLYGON_RPC_URL=https://polygon-bor-rpc.publicnode.com` by default. Override this in the deployment root `.env` with a Polygon PoS mainnet JSON-RPC endpoint and recreate the backend container. An application started outside Compose must set `POLYGON_RPC_URL` explicitly. Do not replace `ETHEREUM_RPC_URL` with a Polygon endpoint. Provider reference: https://polygon.publicnode.com/ and network reference: https://support.polygon.technology/support/solutions/articles/82000889434-how-to-add-polygon-mainnet-on-metamask-

`GET /api/v1/me/assets` now includes a POL entry for connected EVM wallets alongside ETH. The response retains its existing aggregate wallet+exchange contract; a failed eligible exchange still makes the aggregate UNKNOWN/PARTIAL even when a successful wallet contribution is positive. Private quantity contains the successful contributions, not a complete total in that case. No new wallet connection is required. This support is for native POL on Polygon PoS; wrapped POL or ERC20 assets on other networks are not included.

POL rooms support WALLET holder proof for posts/comments with existing freshness, immutable snapshot, source-count and disconnect invalidation rules. Publication refresh uses the existing shared time budget and checks the publication coin's chain first.
