# HODL-129 Rust 쿠키 인증

브라우저 → 동일 출처 Next.js `/api/v1/*` 프록시 → Rust API 구조다.
**Rust가 회원 검증, 토큰 생성·검증·회전, HttpOnly 쿠키 발급·삭제, CSRF 방어를 담당한다.**
Next는 인증 로직을 중복 구현하지 않고 요청과 Rust 응답을 전달한다.

`NEXT_PUBLIC_API_URL`은 서버에서 연결할 신뢰하는 Rust API의 절대 URL이다.
브라우저 HTTP 래퍼는 이 주소로 직접 요청하지 않는다. 운영에서는 HTTPS API를 사용한다.
로그인·회원가입·갱신은 `{ member }`만 반환한다. 토큰은 응답 JSON, 브라우저 저장소 및
클라이언트 상태에 보관하지 않는다. 지갑 로그인은 범위에 포함하지 않는다.

## 쿠키와 CSRF

- Rust의 `cryptalk_access`: 15분, Path=/.
- 기존 Rust refresh 쿠키 `cryptalk_refresh`: 14일, Path=/api/v1/auth.
- 둘 다 HttpOnly, SameSite=Lax, Domain 없음. Rust의 AUTH_COOKIE_SECURE=true(운영 기본값)이면
  Secure를 사용하며, 로컬 HTTP에서는 false로 설정한다. Next는 쿠키 속성을 변경하지 않는다.
- Rust는 인증 POST 및 쿠키 인증 변경 요청에 대해 CORS_ALLOWED_ORIGINS의 정확한 Origin과
  `X-Hodlit-Request: 1`을 검사한다. 목록이 비어 있으면 이 요청을 거부한다.
  Origin 누락/null/미허용 값과 Sec-Fetch-Site: cross-site도 거부한다.
- 프록시도 동일 출처와 전용 헤더를 검사한다. 원래 Origin/전용 헤더/Fetch Metadata를 Rust에 전달한다.
  브라우저의 Authorization과 다른 쿠키를 전달하지 않으며, refresh 쿠키는 refresh/logout에만 전달한다.
- Rust의 두 인증 Set-Cookie만 브라우저에 전달한다. 쿠키는 응답을 제공하는 프론트 호스트에 저장된다.
  리다이렉트를 따라가지 않아 다른 서버에 인증 정보를 전달하지 않는다.
- 로그아웃은 Rust가 DB refresh를 폐기하고 두 쿠키를 삭제한다. 서버/네트워크 오류를 성공으로 숨기거나
  Next가 임의로 쿠키를 삭제하지 않는다. 오류 시 다시 시도할 수 있도록 안내한다.
- refresh 401에는 Rust가 두 쿠키를 삭제하고, 403/서버 오류에는 유지한다.
  stateless JWT를 별도로 복사했다면 로그아웃 후에도 그 JWT는 만료 전까지 유효하다.

## 세션과 캐시

초기 `/me`로 복원하고 401일 때만 갱신한다. 첫 복원 전에는 보호 화면의 로그인 리다이렉트를 보류한다.
헤더도 복원 전에는 로그인 상태를 확정하지 않는다. 네트워크/서버 오류에는 재시도 안내를 표시한다.
403은 권한 오류이며, 갱신 만료(401)만 세션을 비운다. 갱신과 원 요청 재시도는 한 번으로 제한한다.
갱신이 만료되면 GET·HEAD 요청은 쿠키 없이 한 번 재시도해 공개 데이터를 조회한다.

한 탭은 진행 중인 갱신을 공유한다. Web Locks 지원 브라우저는 탭 사이에서도 인증 작업을 직렬화하고,
잠금을 얻은 후 `/me`를 재확인한다. Web Locks 미지원 브라우저의 탭 간 동시 회전은 보장하지 않는다.
BroadcastChannel은 토큰이나 회원 정보 없이 세션 변경만 알린다. 로그인/로그아웃/회원 전환에서는
진행 쿼리를 취소하고 TanStack Query 캐시를 비운다. 늦은 복원·지갑 연결 응답이 이전 회원을 복구하지 않는다.

프록시와 upstream fetch는 no-store이며 프록시 응답은 private, no-store, Vary: Cookie다.
인증된 SSR은 추가하지 않는다. 기존 서버 컴포넌트는 공개 API만 호출한다. 향후 인증된 SSR은 요청별
access 쿠키만 신뢰 API에 전달하고 사용자 응답을 공용 캐시에 저장하지 않아야 한다.

## 배포 및 검증

1. Rust를 별도 주소에 준비하고 AUTH_COOKIE_SECURE=true 및 실제 프론트 Origin을
   CORS_ALLOWED_ORIGINS에 지정한다. preview Origin도 와일드카드 없이 개별 지정한다.
2. 프론트 NEXT_PUBLIC_API_URL을 새 Rust API로 연결하고 배포한다. 구버전 API가 accessToken 본문을
   반환하면 프록시가 502로 거부한다. 구버전으로 자동 우회하거나 토큰을 노출하지 않는다.
   동일 API 주소를 교체한다면 서버·프론트 계약이 함께 바뀌므로 같은 전환 창에서 배포/롤백한다.
3. API 호스트의 기존 refresh 쿠키는 프론트 호스트로 옮길 수 없어 최초 재로그인이 필요하다.
   기존 sessionStorage/localStorage의 cryptalk_access는 마운트 시 삭제한다.
4. 운영 HTTPS에서 Origin 보존, Rust 연결, Secure/HttpOnly/Domain/Path와 전체 인증 흐름을 확인한다.

Rust OpenAPI 스냅샷으로 lib/api-schema.ts를 재생성했다. 백엔드 계약의 원본은 Rust 저장소다.
`pnpm test`는 프록시 전달/CSRF/오류 및 HTTP 갱신 계약을 검증한다.
`pnpm exec playwright install chromium` 후 `pnpm run test:e2e`로 로컬 fixture 테스트를 실행한다.
실제 Rust 통합 검증은 아래 설정을 사용한다. 테스트는 별도 테스트 DB에서만 실행한다.

```bash
# Rust: 로컬 테스트 DB를 준비하고 마이그레이션 적용 후 실행
# AUTH_COOKIE_SECURE=false
# CORS_ALLOWED_ORIGINS=http://localhost:3109
# BIND_ADDR=127.0.0.1:28080
AUTH_E2E_API_URL=http://127.0.0.1:28080 pnpm run test:e2e
```

실제 Rust/PostgreSQL 통합 테스트에서 로그인·회원가입·새로고침·새 탭·동시 갱신·로그아웃·계정 전환·
복원 장애 후 재시도를 검증했다. 브라우저의 access 쿠키 삭제로 만료 상황을 재현하며,
JWT 및 DB refresh의 실제 만료·재사용·동시성은 Rust PostgreSQL 테스트에서 검증한다.
운영 HTTPS 도메인 검증 및 배포는 별도 수행한다.
