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

Raw exception text and response bodies can contain credentials or wallet addresses and are intentionally not logged. Failed reads still return `RPC_ERROR`; HTTP 503 remains the asset API's contract until the separately tracked partial-success/state work (HODL-49).

Unit tests cover successful zero/nonzero balances, malformed payloads, provider errors and missing configuration. Tests are not proof that production is correctly configured. Production `/me/assets` confirmation requires deployment access and a test account; do not close the operational incident based only on these tests.
