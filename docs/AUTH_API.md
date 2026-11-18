# CrypTalk 인증 API 명세

아이디 기반 인증과 로그인 후 지갑을 연결하고 관리하는 API를 설명합니다.

## 기본 정보

- Base URL: `{API_BASE_URL}/api/v1`
- 로컬 예시: `http://localhost:8080/api/v1`
- 요청 형식: `application/json`
- Access token 형식: JWT Bearer token
- Access token 유효 시간: 15분
- Refresh token 유효 시간: 14일

브라우저 클라이언트는 refresh cookie를 주고받을 수 있도록 요청에
`credentials: "include"`를 설정해야 합니다.

```ts
fetch(`${API_BASE_URL}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ loginId, password }),
});
```

인증이 필요한 다른 API에는 access token을 전달합니다.

```http
Authorization: Bearer <accessToken>
```

## 공통 인증 응답

회원가입, 로그인, 세션 갱신 성공 시 HTTP `200 OK`와 다음 응답을 반환합니다.

```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "member": {
    "id": 1,
    "nickname": "satoshi",
    "avatarColor": "#7c3aed",
    "walletAddress": null,
    "assetVisibility": "EXACT",
    "role": "USER"
  }
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `accessToken` | string | API 인증에 사용하는 15분 JWT |
| `tokenType` | string | 항상 `Bearer` |
| `member.id` | number | 회원 ID |
| `member.nickname` | string | 닉네임 |
| `member.avatarColor` | string | 프로필 색상 |
| `member.walletAddress` | string \| null | 연결된 EVM 또는 Solana 지갑 주소 |
| `member.assetVisibility` | string | `EXACT`, `RANGE`, `HIDDEN` 중 하나 |
| `member.role` | string | 현재 DB에 저장된 본인 계정 역할. `USER` 또는 `ADMIN` |

인증된 본인 정보 응답인 `GET /me`, `PATCH /me`, `PATCH /me/asset-visibility`,
지갑 연결 응답도 같은 `MemberResponse`와 `role`을 반환합니다. 회원가입·로그인·세션 갱신은
위 예시처럼 `member.role`로 제공합니다. 역할이 변경되면 `/me` 재조회 또는 세션 갱신으로
현재 역할을 확인할 수 있습니다.

`role`은 관리자 메뉴 등 화면 표시용입니다. 관리자 API는 서버에서 현재 DB 역할을 검증하며,
회원가입·프로필 수정 요청으로 역할을 변경할 수 없습니다. 공개 프로필 및 공개 글·댓글 응답에는
회원의 역할을 포함하지 않습니다.

응답에는 `cryptalk_refresh` HttpOnly cookie도 설정됩니다. JavaScript에서는 이
cookie를 읽을 수 없으며 브라우저가 refresh와 logout 요청에 자동으로 첨부합니다.

| Cookie 속성 | 값 |
|---|---|
| Name | `cryptalk_refresh` |
| Path | `/api/v1/auth` |
| HttpOnly | `true` |
| Max-Age | `1209600`초(14일) |
| 개발 환경 | `SameSite=Lax` |
| HTTPS 환경 | `SameSite=None; Secure` (`AUTH_COOKIE_SECURE=true`) |

## 오류 응답

오류 응답의 공통 형식은 다음과 같습니다.

```json
{
  "message": "오류 메시지",
  "timestamp": "2026-08-31T13:30:00Z"
}
```

유효성 검증 실패 메시지는 `필드명: 검증 메시지` 형식입니다.

## 1. 회원가입

```http
POST /api/v1/auth/signup
Content-Type: application/json
```

### 요청

```json
{
  "loginId": "satoshi_21",
  "password": "strong-password-123",
  "nickname": "새회원"
}
```

| 필드 | 필수 | 제약 |
|---|---|---|
| `loginId` | 예 | 4~40자, 영문·숫자·마침표·밑줄·하이픈만 허용 |
| `password` | 예 | 8~72자 |
| `nickname` | 예 | 앞뒤 공백 제거 후 2~40자. 한글, 영문, 숫자, `_`, `-` 허용 |

아이디는 소문자로 저장됩니다. 회원가입과 `PATCH /api/v1/me`의 닉네임 변경은
앞뒤 공백을 제거한 뒤 길이, 허용 문자, 중복을 검사합니다. 내부 공백과 이모지는 허용하지 않습니다.
비밀번호는
BCrypt cost 12로 해시됩니다.

기존 이메일 계정은 마이그레이션 과정에서 종전 이메일이 `loginId`로 승계됩니다.
따라서 기존 회원은 아이디를 별도로 정하기 전까지 기존 이메일을 `loginId` 값으로
보내 로그인할 수 있습니다.

### 응답

- `200 OK`: 공통 인증 응답 및 refresh cookie 발급
- `400 Bad Request`: 요청값 검증 실패
- `409 Conflict`: 이미 사용 중인 아이디 또는 닉네임

```bash
curl -i -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"satoshi_21","password":"strong-password-123","nickname":"새회원"}' \
  http://localhost:8080/api/v1/auth/signup
```

## 2. 로그인

```http
POST /api/v1/auth/login
Content-Type: application/json
```

### 요청

```json
{
  "loginId": "satoshi_21",
  "password": "strong-password-123"
}
```

| 필드 | 필수 | 제약 |
|---|---|---|
| `loginId` | 예 | 최대 254자 (신규 아이디는 회원가입 제약 적용) |
| `password` | 예 | 최대 72자 |

### 응답

- `200 OK`: 공통 인증 응답 및 refresh cookie 발급
- `400 Bad Request`: 요청값 검증 실패
- `401 Unauthorized`: 아이디 또는 비밀번호 불일치

보안을 위해 존재하지 않는 아이디와 잘못된 비밀번호는 같은 오류 메시지를
반환합니다.

```bash
curl -i -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"satoshi_21","password":"strong-password-123"}' \
  http://localhost:8080/api/v1/auth/login
```

## 3. 세션 갱신

```http
POST /api/v1/auth/refresh
Cookie: cryptalk_refresh=<refreshToken>
```

요청 body는 없습니다. 유효한 refresh cookie를 사용하면 기존 refresh token을
폐기하고 새로운 access token과 refresh cookie를 발급합니다.

### 응답

- `200 OK`: 공통 인증 응답 및 새로운 refresh cookie 발급
- `401 Unauthorized`: cookie 누락, 만료, 폐기 또는 유효하지 않은 token

```bash
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/refresh
```

클라이언트는 access token이 만료되어 보호 API가 `401`을 반환하면 refresh를 한 번
시도하고, 성공했을 때 원래 요청을 새 access token으로 한 번만 재시도해야 합니다.

## 4. 로그아웃

```http
POST /api/v1/auth/logout
Cookie: cryptalk_refresh=<refreshToken>
```

요청 body는 없습니다. 전달된 refresh token이 있으면 서버에서 폐기하고 브라우저의
cookie를 삭제합니다. Cookie가 없어도 성공하므로 로그아웃은 반복 호출할 수 있습니다.

### 응답

- `204 No Content`: 로그아웃 처리 완료
- 응답 body 없음
- `cryptalk_refresh` cookie를 `Max-Age=0`으로 삭제

```bash
curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/logout
```

로그아웃 후 클라이언트는 메모리나 `sessionStorage`에 저장한 access token도 반드시
삭제해야 합니다.

## 지원하지 않는 지갑 로그인 API

다음 공개 인증 API는 제거되어 더 이상 지원하지 않습니다.

- `POST /api/v1/auth/nonce`
- `POST /api/v1/auth/wallet`

로그인한 사용자의 선택적 지갑 연결은 별도의 보호된 `/api/v1/me/wallet/**` API를
사용합니다.

## 지갑 연결 및 관리

아이디로 로그인한 뒤 EVM 또는 Solana 지갑을 여러 개 연결할 수 있습니다. 동일한 체인과 주소의
조합은 한 회원에게만 연결됩니다. Solana는 계정에 지갑을 연결하고 관리할 수 있으며, SOL·SPL 잔액
조회와 보유 인증은 별도 기능입니다.

| 기능 | Method | Path | 인증 |
|---|---|---|---|
| 연결 nonce 발급 | POST | `/api/v1/me/wallet/nonce` | 필요 |
| 서명 검증 및 연결 | POST | `/api/v1/me/wallet` | 필요 |
| 내 지갑 목록 | GET | `/api/v1/me/wallets` | 필요 |
| 지갑 연결 해제 | DELETE | `/api/v1/me/wallets/{walletId}` | 필요, 소유자 |

nonce 요청과 연결 요청 모두 `walletAddress`와 선택 필드 `chainType`을 받습니다. 연결 요청에는
`nonceId`와 `signature`도 필요합니다. 두 요청에서 같은 체인과 주소를 사용합니다. nonce는
로그인 회원, `LINK` 목적, 체인, 주소에 묶이며 5분 동안 한 번만 사용할 수 있습니다.

- `EVM`은 `chainType`을 생략했을 때의 기본값입니다. `0x` 주소와 `personal_sign`의 16진수 서명을 받습니다.
- `SOLANA`는 32바이트 공개 키의 Base58 주소를 받으며 대소문자를 그대로 보존합니다.
  nonce 응답의 `message`를 UTF-8 바이트로 변환해 Solana `signMessage`로 서명하고, 64바이트
  Ed25519 서명을 Base58 문자열로 제출합니다. WalletConnect의 `solana_signMessage` 결과와
  호환됩니다. AppKit이 서명을 바이트로 반환하면 요청 전에 Base58로 인코딩합니다.

```json
[
  {
    "id": 12,
    "chainType": "EVM",
    "address": "0x1111111111111111111111111111111111111111",
    "connectedAt": "2026-09-05T10:00:00Z"
  }
]
```

목록의 전체 주소는 본인에게만 반환합니다. 연결과 해제 이벤트는 별도 이력으로 남고, 지갑을
해제해도 과거 글과 댓글의 발행 당시 보유 스냅샷은 변경되지 않습니다.

## Swagger/OpenAPI

- Swagger UI: `{API_BASE_URL}/swagger-ui.html`
- OpenAPI JSON: `{API_BASE_URL}/v3/api-docs`
