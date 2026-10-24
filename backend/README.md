# CrypTalk Backend

Java 24와 Spring Boot 3.5.16으로 구현한 CrypTalk API입니다.

## 로컬 실행

1. 저장소 루트에서 `docker compose up -d mysql`
2. `cd backend && ./gradlew bootRun`
3. Swagger UI: http://localhost:8080/swagger-ui.html

## API 테스트 페이지

현재 OpenAPI 문서에 등록된 모든 API와 MetaMask 지갑 연결 흐름을 브라우저에서 직접
시험하려면 테스트 페이지를 명시적으로 활성화합니다.

```bash
CRYPTALK_TEST_PAGES_ENABLED=true ./gradlew bootRun
```

실행 후 http://localhost:8080/test 에 접속합니다. 허브에서 `/test/auth`, `/test/wallet`,
`/test/api` 하위 페이지로 이동할 수 있습니다. 페이지는 백엔드와 같은 origin에서 동작하며
회원가입·로그인, JSON 및 multipart 요청, MetaMask `personal_sign`, 연결 지갑과 자산 조회를
지원합니다. 페이지 내 이동은 새로고침 없이 처리되어 access token을 브라우저 메모리에만
보관합니다. 테스트 페이지는 기본적으로 비활성화되며 운영 환경에서는 활성화하지 마세요.

기본 설정은 로컬 개발용입니다. 운영 환경에서는 `DB_*`, `JWT_SECRET`,
`ALCHEMY_API_KEY`, `CORS_ALLOWED_ORIGINS`를 반드시 설정하세요. 코인 가격은 기본적으로
CoinGecko 공개 API에서 조회하며 필요하면 `MARKET_PRICE_BASE_URL`로 호스트를 교체할 수 있습니다.

로그인한 계정의 지갑 연결은 EVM 지갑의 `personal_sign` 서명을 검증합니다. 지갑 잔액은
Alchemy Portfolio API만 사용해 Ethereum·Polygon 기본 자산과 ERC20을 조회합니다.
연결 지갑이 있는데 API 키가 없으면 자산 조회는 503이며 발행 보유 인증은 UNKNOWN입니다.
