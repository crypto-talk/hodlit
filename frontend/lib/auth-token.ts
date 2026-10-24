/**
 * 액세스 토큰을 읽고 쓰는 유일한 지점 (B-3 전까지의 임시 구현).
 *
 * `lib/http.ts` 도 여기를 거친다. 저장소를 두 군데 두면 한쪽이 갱신됐는데
 * 다른 쪽이 옛 토큰을 들고 있는 상태가 생기고, 증상이 "가끔 로그아웃됨"으로만
 * 보여서 추적이 어렵다.
 *
 * 백엔드가 access 를 httpOnly 쿠키로 옮기면(B-3) 이 파일은 통째로 사라진다.
 * 그때 `lib/http.ts` 에서 Authorization 헤더를 세우는 줄도 같이 빠지고,
 * 그 외 호출부는 바뀌지 않는다. 키 이름 `cryptalk_access` 도 함께 없어지므로
 * 지금 바꾸지 않는다.
 */

const STORAGE_KEY = "cryptalk_access";

/**
 * 서버에서는 항상 null 이다. 모듈 변수는 요청 사이에 공유되므로, 서버에서
 * 토큰을 캐시하면 다른 사용자의 요청에 남의 토큰이 실릴 수 있다.
 *
 * 브라우저에서 캐시를 두는 이유는 두 가지다. 요청마다 sessionStorage 를 읽지
 * 않는 것, 그리고 프라이빗 모드처럼 저장소 접근이 막힌 환경에서도 그 탭 안에서는
 * 로그인이 유지되는 것.
 */
let cached: string | null = null;
let loaded = false;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  if (!loaded) {
    try {
      cached = window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      cached = null;
    }
    loaded = true;
  }
  return cached;
}

export function setAccessToken(token: string): void {
  cached = token;
  loaded = true;
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // 저장에 실패해도 이 탭에서는 캐시만으로 동작한다. 새로고침하면 풀린다.
  }
}

export function clearAccessToken(): void {
  cached = null;
  loaded = true;
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 위와 같다.
  }
}
