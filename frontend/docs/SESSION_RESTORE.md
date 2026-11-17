# 새로고침 시 세션 복원 (HODL-125)

기존 초기화는 sessionStorage에 유효한 access token이 있어도 곧바로 refresh를 호출했다.
refresh 쿠키가 전송되지 않거나 요청이 일시적으로 실패하면 access까지 지우고 비로그인으로
확정했다. 초기 복원과 일반 API의 401 갱신도 별도 요청이어서 토큰 회전이 중복될 수 있었다.

복원은 이제 저장된 access를 실은 `GET /api/v1/me`로 시작한다. 401인 경우에만 기존 HTTP
래퍼의 공유 refresh를 거쳐 회원 정보를 다시 조회한다. React Strict Mode의 중복 복원과
일반 요청도 같은 갱신을 사용한다. 이전 요청의 늦은 401은 새 access로 한 번 재시도하며,
로그아웃·로그인 뒤 도착한 옛 refresh 결과는 토큰 저장소를 덮어쓰지 않는다.

refresh의 401은 세션 만료로 처리한다. 네트워크·403·5xx 오류는 토큰을 보존하고 복원
재시도를 표시한다. 복원이 끝나기 전에는 헤더 로그인 링크와 보호 동작의 로그인 이동을
보류한다. 글쓰기·마이페이지의 기존 `restored` 검사도 그대로 사용한다.

## 검증

`frontend/`에서 다음을 실행한다.

```sh
pnpm exec tsc --noEmit
pnpm run lint
pnpm test
NEXT_PUBLIC_API_URL=http://localhost:8798 pnpm run build
NEXT_PUBLIC_API_URL=http://localhost:8798 pnpm run test:html
pnpm exec playwright install chromium
pnpm run test:e2e
```

브라우저 테스트는 실제 Next 앱과 요청 fixture를 사용하며 API 서버를 필요로 하지 않는다.
홈·글쓰기 새로고침, refresh 쿠키 없이 유효한 access 복원, 만료된 access 갱신, 느린 복원,
503 후 재시도, 실제 만료와 로그아웃을 확인한다. 단위 테스트는 중복 복원/401 갱신 공유,
갱신 장애 및 늦은 갱신 응답도 검사한다.

## 운영 확인 및 후속 전환

2026-11-17에 운영 홈의 200 응답과 기존 API `/api/v1/me`의 미인증 401,
`Access-Control-Allow-Origin: https://hodlit.xyz` 및 credentials 허용을 확인했다.
운영 사용자 계정으로 로그인한 재현·수정 확인과 배포는 수행하지 않았다. 실제 운영 원인이
특정 브라우저의 쿠키 차단인지까지 확인한 결과는 아니다. 배포 후 홈·글쓰기에서 로그인,
새로고침, access 만료 후 갱신, 로그아웃을 실제 HTTPS 환경에서 확인해야 한다.

이 변경은 현재의 Bearer access + HttpOnly refresh 계약을 유지한다. API 호스트가 다른
사이트일 때 브라우저가 refresh 쿠키를 차단하는 문제 자체를 변경하지 않는다.
HODL-129의 쿠키 인증 전환 PR #115는 복원 흐름 일부를 함께 수정한다. 두 PR은 `api.ts`,
`http.ts`, `session.tsx`, 헤더 및 테스트 설정이 겹치므로 병합 순서에 따라 조정해야 한다.
쿠키 전환 시에는 저장소 revision 대신 해당 PR의 쿠키 갱신 조정 방식을 사용하고,
여기에 추가한 회귀 시나리오를 새 인증 계약에 맞게 유지한다.
