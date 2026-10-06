/**
 * 코인 심볼 → 한글명.
 *
 * `lib/mock/landing.ts` 에 있던 표를 방(room) 쪽으로 옮겼다가, 글쓰기의 방 선택도
 * 같은 표를 쓰게 되어 `lib/` 으로 내렸다. features 끼리는 참조할 수 없다(구조 규칙 1).
 * 목데이터가 아니라 백엔드에 없는 필드를 프론트가 메우는 매핑표다.
 */

/**
 * `GET /api/v1/coins`는 영문명만 돌려줍니다(`Bitcoin`).
 * 디자인은 한글명을 쓰므로 프론트에서 매핑합니다.
 * 백엔드에 한글명 필드가 생기면 이 표는 지웁니다.
 */
export const COIN_NAME_KO: Record<string, string> = {
  BTC: "비트코인",
  ETH: "이더리움",
  SOL: "솔라나",
  XRP: "리플",
  DOGE: "도지코인",
  ADA: "카르다노",
  BNB: "BNB",
  AVAX: "아발란체",
  DOT: "폴카닷",
  LINK: "체인링크",
  POL: "폴리곤",
  TON: "톤코인",
  TRX: "트론",
  LTC: "라이트코인",
  BCH: "비트코인 캐시",
  UNI: "유니스왑",
  AAVE: "에이브",
  ATOM: "코스모스",
  NEAR: "니어",
  SUI: "수이",
  ARB: "아비트럼",
  OP: "옵티미즘",
};

export const coinNameKo = (symbol: string, fallback: string) => COIN_NAME_KO[symbol] ?? fallback;
