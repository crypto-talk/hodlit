/**
 * 환경변수를 읽는 유일한 지점 (F-9).
 *
 * `process.env` 를 다른 파일에서 직접 읽지 않는다. 여기서 한 번 읽고 검증한다.
 * `NEXT_PUBLIC_` 접두사는 브라우저 번들에 포함된다는 뜻이므로, 공개해도 되는
 * 값에만 붙인다. 지갑 주소는 환경변수가 아니라 사용자 데이터다.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`환경변수 ${name} 가 없습니다. .env.example 을 참고해 .env.local 에 채우세요.`);
  }
  return value;
}

/**
 * Next 는 빌드 시점에 `process.env.NEXT_PUBLIC_*` 를 문자열로 치환한다.
 * 그래서 동적 접근(`process.env[name]`)이 아니라 리터럴로 적어야 한다.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/**
 * WalletConnect(Reown) projectId. 공개해도 되는 값이다(브라우저가 relay 에 붙을 때 쓴다).
 * 비어 있으면 지갑 연결이 예전처럼 브라우저 확장으로만 돈다. 그래서 빌드를 깨지 않는다.
 */
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const config = {
  /** Spring Boot 백엔드 주소. 개발 기본값은 로컬 8080. */
  apiUrl,
  /** 없으면 빈 문자열. `lib/wallet-link.ts` 가 쓴다. */
  walletConnectProjectId,
} as const;

/**
 * 프로덕션 빌드에서 값이 비어 있으면 런타임이 아니라 빌드 때 터뜨린다.
 * 로컬 기본값에 기대어 배포본이 localhost 를 때리는 사고를 막는 용도다.
 *
 * 이 모듈은 `lib/http.ts` 를 타고 모든 요청 경로에 들어가므로, 여기서 한 번
 * 부르면 빌드가 실패한다. 조용히 localhost 를 때리다 브라우저에서야 알게 되는
 * 것보다 낫다.
 */
function assertConfig(): void {
  if (process.env.NODE_ENV === "production") {
    required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL);
  }
}

assertConfig();
