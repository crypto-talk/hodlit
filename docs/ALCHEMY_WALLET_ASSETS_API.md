# Alchemy 지갑 자산 조회

## 운영 설정

배포 서버 프로젝트 루트 `.env`에 `ALCHEMY_API_KEY`를 설정합니다. Compose가 백엔드 컨테이너로 전달하며, 변경 후 컨테이너를 재생성해야 합니다. 키는 서버에서만 사용하고 응답·로그·프론트 코드에 포함하지 않습니다.

```env
ALCHEMY_API_KEY=발급받은_키
ALCHEMY_BASE_URL=https://api.g.alchemy.com
```

Alchemy ETH JSON-RPC endpoint와 Portfolio API는 별개입니다. 이 연동은 `POST /data/v1/{apiKey}/assets/tokens/by-address`를 호출합니다. ETH endpoint로 `ALCHEMY_BASE_URL`을 바꾸지 마세요. 지갑 조회는 Alchemy만 사용합니다. 기존 ETH/POL 직접 RPC 경로와 대체 조회를 제거했습니다. Alchemy 조회 실패를 빈 잔액으로 덮지 않습니다.

기본 대상은 Ethereum Mainnet(`eth-mainnet`, chain ID 1)과 Polygon PoS(`matic-mainnet`, chain ID 137)입니다. Alchemy 앱에서 해당 네트워크 및 Portfolio API 사용 권한을 확인해야 합니다. 실제 발급 키로 조회 성공 여부는 운영 환경에서 확인해야 합니다.

## 지갑 전용 조회

`GET /api/v1/me/wallets/assets`는 JWT의 회원에 연결된 지갑만 조회합니다. 지갑 주소·회원 ID를 요청으로 지정하지 않습니다. 거래소 API를 호출하지 않으며 결과에 거래소 잔액을 포함하지 않습니다. 인증이 없으면 401, 회원이 없으면 404, 연결 지갑이 있는데 API 키가 없으면 503입니다. 연결 지갑이 없으면 빈 `assets`와 `READY`를 반환합니다. 응답은 인증된 개인 자산 데이터이며 캐시하지 않습니다.

```json
{
  "assets": [
    {
      "walletAddress": "0x…",
      "network": "matic-mainnet",
      "chainId": 137,
      "contractAddress": null,
      "symbol": "POL",
      "name": "Polygon",
      "decimals": 18,
      "rawBalance": "5000000000000000000",
      "quantity": 5,
      "status": "READY"
    }
  ],
  "unresolvedAssets": [],
  "failedNetworks": [],
  "paginationComplete": true,
  "syncStatus": "READY",
  "capturedAt": "2026-10-11T12:00:00Z"
}
```

기본 자산은 `contractAddress=null`, ERC20은 계약 주소를 반환합니다. 서비스 코인 목록에 없는 토큰도 포함됩니다. `rawBalance`는 소수점 적용 전 정수의 10진 문자열입니다. ERC20의 메타데이터/소수점 정보를 얻지 못하면 `decimals`와 `quantity`는 생략될 수 있고 `rawBalance`는 유지됩니다. 임의로 18자리로 추정하지 마세요. `status=UNKNOWN`인 토큰은 원본 잔액도 확인하지 못한 상태입니다. 토큰 표시용 이름·심볼은 공급자 메타데이터이고 보유 인증의 식별자로 사용하지 않습니다. 여러 지갑의 항목은 `walletAddress`별로 구분됩니다.

`assets`에는 원본 잔액(`rawBalance`)이 양수인 항목만 포함합니다. 기본 자산과 ERC20 모두 확인된 0잔액은 제외하며, 소수점 정보가 없어도 원본 잔액이 양수이면 포함합니다. 원본 잔액 자체를 확인하지 못한 토큰은 `unresolvedAssets`로 반환합니다. 네트워크 실패·페이지 중단은 기존 `failedNetworks`와 `paginationComplete`로 구분합니다. 따라서 자산 목록이 비어 있어도 실패 상태가 있으면 전체 미보유로 해석하면 안 됩니다.

## 기존 통합 자산 API와 인증

`GET /api/v1/me/assets`의 기존 `assets`는 서비스 코인의 지갑+거래소 합산 스냅샷 계약을 유지합니다. 새 `walletAssets` 필드에는 위 지갑 전용 결과를 함께 제공합니다. 동일 요청에서 Alchemy를 두 번 조회하지 않습니다. 연결 지갑이 있는데 키가 없으면 이 API도 503으로 설정 필요를 안내합니다. 지갑 없이 거래소만 연결한 회원은 Alchemy 키 없이 거래소 조회를 사용할 수 있습니다. 발행 시 키 미설정은 지갑 조회 실패로 취급하되 거래소 조회는 계속합니다. 성공한 거래소의 양수 잔액이 있으면 보유 인증하고, 없으면 UNKNOWN으로 처리합니다. 이전 인증 캐시가 최신이어도 재인증으로 사용하지 않습니다.

통합 `assets`도 합산된 확인 수량이 양수인 항목만 반환합니다. 확인 불가 상태는 최상위 `unresolvedAssets`의 `{symbol,status,syncStatus,holderStatus}`에 따로 반환합니다. 일부 수단에서 양수 잔액을 확인했지만 다른 수단에 실패한 경우, 확보된 양수 부분합은 `assets`에 유지하고 `verified=true`, `holderStatus=HOLDER`로 인증합니다. 동시에 `syncStatus=PARTIAL` 및 `unresolvedAssets`로 조회 불완전 상태를 알립니다. `unresolvedAssets`에 있는 항목도 확인된 양수 부분합이 있으면 `holderStatus=HOLDER`일 수 있습니다. 이 부분합을 정확한 전체 잔액으로 표시하지 마세요. `walletAssets.assets`는 거래소 상태와 독립된 지갑 양수 목록입니다.

필터는 HTTP 응답에만 적용합니다. 내부 보유 기록 및 Alchemy 조회 결과에는 0잔액·조회 실패 정보를 유지하여 글·댓글의 EMPTY/UNKNOWN을 구분하며, 기존 발행 스냅샷은 변경하지 않습니다.

서비스 코인의 `chain_id`, `asset_type`, `contract_address`, `token_decimals`가 정확히 설정된 경우만 지갑 잔액을 인증에 연결합니다. 기본 자산은 체인과 null 계약 주소, ERC20은 체인과 계약 주소가 모두 일치해야 합니다. 심볼만 같은 토큰은 인증에 반영하지 않습니다. 등록 계약 정보가 없는 ERC20도 지갑 목록에서는 확인할 수 있지만 해당 코인 방의 인증으로 자동 연결되지 않습니다. 현재 기본 등록 인증 정보는 ETH와 POL이며, 다른 코인은 신뢰할 수 있는 계약 정보를 별도로 설정해야 합니다.

페이지를 모두 조회했고 해당 네트워크가 성공한 경우에만 누락된 등록 토큰을 0으로 판단합니다. 모두 성공한 0잔액은 EMPTY입니다. 조회 실패/잘린 결과에서도 성공적으로 확인된 양수 잔액이 있으면 HOLDER/PARTIAL이며, 없으면 UNKNOWN/PARTIAL입니다. 지갑 또는 거래소 일부 실패가 다른 수단에서 확인한 양수 잔액의 보유 인증을 취소하지 않습니다. 글·댓글 발행 시에도 동일한 부분합으로 보유 상태를 고정하며, 글의 수량 구간은 부분합 기준입니다. 댓글의 공개 응답에는 기존대로 수량/수량 구간이 없습니다. `walletAssets`는 거래소 상태와 독립적입니다. 발행 시 갱신, 최신성, 불변 공개 스냅샷 규칙을 유지합니다. 미등록 자산을 DB 코인으로 자동 생성하거나 임의의 인증 계약 주소를 등록하지 않습니다.

## 페이지·장애 처리

Alchemy의 `pageKey`를 따라 마지막 페이지까지 읽고 지갑·체인·계약별 중복 항목을 중복 합산하지 않습니다. 10개 지갑씩 요청하며 전체 조회는 15초, 최대 20페이지/5,000개 항목으로 제한합니다. 한도를 넘거나 후속 페이지에 실패하면 확보한 항목은 유지하지만 `paginationComplete=false`, `syncStatus=PARTIAL`로 표시합니다. 발행용 조회는 기존 발행 갱신 시간 예산(기본 3초)을 사용합니다.

HTTP 200의 `error.partialErrors`도 확인하여 `failedNetworks`에 반영합니다. 실패한 지갑·네트워크의 행은 합산에서 제외합니다. 오류에 지갑 주소가 없으면 해당 배치의 해당 네트워크 행 전체를 제외하고, 네트워크도 불명확하면 해당 배치의 모든 네트워크를 제외합니다. 개별 행 파싱 실패는 다른 정상 행 처리를 막지 않으며, 동일 지갑·체인·계약에서 상충하는 잔액은 최초 값도 인증에 사용하지 않습니다. 해당 체인의 전체 성공을 추정하지 않습니다. 전체 실패는 UNKNOWN, 일부 결과/네트워크 실패는 PARTIAL입니다. 실패 응답에 포함된 메시지·API 키가 들어 있는 URL은 로그에 기록하지 않습니다. 로그에는 HTTP 상태 또는 예외 클래스만 기록합니다. 이 API는 토큰 전송 이력·NFT 목록을 조회하지 않습니다.

공급자 계약: [Tokens By Wallet](https://www.alchemy.com/docs/data/portfolio-apis/portfolio-api-endpoints/portfolio-api-endpoints/get-tokens-by-address), [부분 실패 처리](https://www.alchemy.com/docs/reference/portfolio-apis#handling-partial-failures).
