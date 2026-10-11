# 지갑 자산 조회 운영 확인

지갑 잔액 조회는 Alchemy Portfolio API만 사용합니다. Ethereum Mainnet과 Polygon PoS의 기본 자산 및 ERC20을 동일 경로에서 조회합니다. 직접 RPC 클라이언트와 대체 조회 경로는 제거되었습니다.

1. 배포 서버 프로젝트 루트 `.env`에 `ALCHEMY_API_KEY`를 설정하고 백엔드 컨테이너를 재생성합니다. 키·URL·.env 전체를 로그나 채팅으로 출력하지 마세요.
2. Alchemy 앱에서 Ethereum/Polygon 및 Portfolio API 사용 권한을 확인합니다. 키를 ETH JSON-RPC endpoint와 혼동하지 마세요. 기본 `ALCHEMY_BASE_URL`은 `https://api.g.alchemy.com`입니다.
3. 지갑 연결 계정으로 `GET /api/v1/me/wallets/assets`를 호출합니다. 거래소를 조회하지 않는 지갑 전용 API입니다. 부분 실패는 `failedNetworks`, 잘린 목록은 `paginationComplete=false`로 구분합니다.
4. 통합 `GET /api/v1/me/assets`에는 기존 합산 `assets`와 지갑 목록 `walletAssets`가 함께 나옵니다. 200만으로 모든 잔액 확인이 성공했다고 판단하지 말고 READY/PARTIAL/UNKNOWN을 확인합니다.

연결 지갑이 있는데 키가 없으면 두 조회 API는 503을 반환합니다. 글·댓글 발행은 계속 진행하되 보유 상태는 UNKNOWN이며 최신 캐시도 재인증하지 않습니다. 지갑 없는 거래소 전용 계정은 Alchemy 키가 필요하지 않습니다. 조회 성공한 0잔액만 EMPTY입니다.

실패 로그에는 HTTP 상태 또는 예외 종류만 포함됩니다. 공급자 응답 본문·URL·키·지갑 주소를 로그에 포함하지 않습니다. 테스트와 배포 헬스체크는 실제 운영 계정의 잔액 조회 성공을 대신하지 않습니다.

상세 계약: [Alchemy 지갑 자산 API](ALCHEMY_WALLET_ASSETS_API.md).
