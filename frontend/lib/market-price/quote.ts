import { MARKET_COINS } from "./coins";

/**
 * 시세 한 건의 모양과 공통 에러. 업비트 · CoinGecko 두 출처가 같은 모양으로 돌려준다.
 */

/** 시세를 어디서 받았나. 화면이 출처와 등락률 기준을 적는 데 쓴다. */
export type QuoteSource = "upbit" | "coingecko";

/** 원화 시세 한 건. */
export type MarketQuote = {
  source: QuoteSource;
  /** 원화 가격. 업비트는 마지막 체결가, CoinGecko 는 해외 시세의 원화 환산값. */
  price: number;
  /** 등락률(%). 출처가 안 주면 null. */
  changeRate: number | null;
  /**
   * 등락률 기준. 업비트는 전일 종가 대비(`prev-close`), CoinGecko 는 24시간(`24h`).
   * 둘이 다르므로 화면 문구도 다르게 적는다.
   */
  changeBasis: "prev-close" | "24h";
  /** 출처가 이 값을 만든 시각(ms). 업비트는 마지막 체결 시각. 없으면 null. */
  updatedAt: number | null;
};

/** 코인 기호 → 시세. 응답에 없거나 값이 이상한 코인은 빠진다. */
export type MarketQuotes = Record<string, MarketQuote>;

/** 줄 세운 시세 한 칸. 전광판처럼 여러 코인을 차례로 그리는 곳이 쓴다. */
export type SymbolQuote = { symbol: string; quote: MarketQuote };

/**
 * 시세를 `MARKET_COINS` 순서로 줄 세운다. 응답에 없는 코인은 빠진다.
 * 응답 순서를 따르지 않는 이유: 출처마다 순서가 달라 갱신 때마다 칸이 뒤섞일 수 있다.
 */
export function orderQuotes(quotes: MarketQuotes): SymbolQuote[] {
  return Object.keys(MARKET_COINS).flatMap((symbol) => {
    const quote = quotes[symbol];
    return quote ? [{ symbol, quote }] : [];
  });
}

/**
 * 호출 제한(429) · 일시 차단(418, 업비트). 다른 실패와 달리 바로 다시 부르면 안 된다.
 */
export class PriceRateLimited extends Error {
  constructor(source: QuoteSource) {
    super(`${source} 호출 제한에 걸렸습니다.`);
    this.name = "PriceRateLimited";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
