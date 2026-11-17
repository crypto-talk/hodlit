# HODL-129 쿠키 인증

브라우저 → 동일 출처 Next.js `/api/v1/*` BFF → 기존 API 구조다. 백엔드의 Bearer 및
`cryptalk_refresh` 계약을 변경하지 않고 BFF가 브라우저 쿠키 계약을 제공한다.
`NEXT_PUBLIC_API_URL`은 서버에서 연결할 신뢰하는 API의 절대 URL이다. 사용자 입력으로
설정하지 않는다. 운영에서는 HTTPS API를 사용한다. 브라우저 HTTP 래퍼는 이 주소로
직접 요청하지 않는다. 기존 OpenAPI 타입은 upstream 계약이며 BFF 인증 응답은
`{ member }`만 반환한다. 지갑 로그인은 지원하지 않으며 기존 지갑 연결 API는 그대로다.

## 쿠키·CSRF

- `hodlit_access`: 15분, `hodlit_refresh`: 14일. 둘 다 HttpOnly, SameSite=Lax,
  Path=/, Domain 없음(프론트 호스트 전용). 운영 및 미리보기에서는 Secure,
  로컬 `next dev` HTTP에서는 Secure를 사용하지 않는다.
- BFF는 발급·회전 시 upstream 응답의 accessToken과 refresh Set-Cookie를 소비하고
  토큰을 브라우저 JSON에 반환하지 않는다. upstream Set-Cookie는 그대로 전달하지 않는다.
- 변경 요청에는 동일 Origin과 `X-Hodlit-Request: 1`이 필수다. cross-site 요청을 거부한다.
  로그인·회원가입·갱신·로그아웃에도 동일하게 적용한다. 교차 출처 CORS를 열지 않는다.
  배포 프록시는 외부 호스트와 프로토콜을 Next.js 요청 URL에 정확히 보존해야 한다.
- API로는 필요한 Content-Type/Accept, access Bearer, 인증 경로의 refresh 쿠키만 전달한다.
  브라우저가 제공한 Authorization, 다른 쿠키 및 Origin은 전달하지 않는다.
  리다이렉트를 따라가지 않아 다른 서버에 인증 정보를 전달하지 않는다.
- 로그아웃은 두 브라우저 쿠키를 삭제한다. upstream 장애 시 서버의 refresh 폐기는
  최선 노력이며, 이미 유출된 upstream 토큰까지 즉시 무효화하는 기능은 아니다.

## 세션과 캐시

초기 `/me`로 복원하고 401일 때만 갱신한다. 첫 복원이 끝나기 전에는 보호 동작의
로그인 리다이렉트를 보류한다. 네트워크/서버 장애는 재시도 안내를 표시하며 비로그인으로
확정하지 않는다. 403은 권한 오류로 전달한다. 갱신 만료(401)만 세션을 비운다.

한 탭은 진행 중인 갱신을 공유한다. Web Locks 지원 브라우저는 탭 사이에서도 인증 작업을
직렬화하고, 잠금을 얻은 후 `/me`를 재확인해 불필요한 회전을 막는다. Web Locks가 없는
브라우저의 탭 간 동시 회전은 보장하지 않는다. BroadcastChannel은 로그인/로그아웃 변경을
다른 탭에 알려 재복원하고, 토큰이나 회원 정보를 메시지에 넣지 않는다.
로그인·로그아웃·회원 전환에서는 진행 쿼리를 취소하고 TanStack Query 캐시를 비운다.

BFF와 upstream fetch는 no-store이며 BFF 응답은 private, no-store, Vary: Cookie다.
인증된 SSR은 이번 변경에 추가하지 않는다. 기존 서버 컴포넌트는 공개 API만 호출하고
사용자의 Cookie/Authorization을 전달하지 않는다. 향후 SSR에서는 서버 전용 함수로
요청별 access 쿠키만 신뢰하는 upstream에 전달하고, 공용 캐시를 사용하지 않아야 한다.

## 배포 및 검증

1. 기존 API의 로그인/회원가입/갱신이 accessToken과 회전 refresh 쿠키를 반환하는지 확인한다.
2. Vercel에서 `NEXT_PUBLIC_API_URL`의 API 접근과 외부 Origin 보존을 확인한 뒤 프론트를 배포한다.
   별도 백엔드 배포 및 교차 출처 credentials CORS 설정은 필요 없다.
3. API 호스트의 기존 refresh 쿠키는 프론트 호스트로 옮길 수 없으므로 최초 전환 시 재로그인한다.
   이전 sessionStorage/localStorage의 `cryptalk_access`는 마운트 시 삭제한다.
4. 운영 HTTPS에서 Secure/HttpOnly/Domain/Path와 로그인·새 탭·만료·로그아웃을 확인한다.

`pnpm test`는 BFF 쿠키/CSRF/자격 증명 전달/오류와 HTTP 갱신 계약을 검증한다.
`pnpm exec playwright install chromium` 후 `pnpm run test:e2e`는 별도 로컬 API fixture와
Next dev를 띄워 실제 브라우저의 로그인·회원가입·새로고침·새 탭·갱신·만료·로그아웃을 검증한다.
fixture는 운영 백엔드 및 Vercel 배포 검증을 대신하지 않는다.
