import { MARKET_COINS } from "./coins";

/**
 * CoinGecko 시세 직접 호출 (HODL-61).
 *
 * 백엔드 `MarketPriceService` 가 하던 일을 브라우저가 한다. 같은 `/simple/price`, 키 없음,
 * 원화 · 24시간 등락률 · 갱신 시각.
 *
 * 비밀 키를 쓰지 않는다. 키 없는 공개 API 라 프론트 번들에 넣을 값이 없다.
 * 요청 헤더도 붙이지 않는다 — 단순 GET 이라 CORS 사전 요청(preflight)이 생기지 않는다.
 *
 * 표에 있는 코인을 한 번에 묶어 부른다. 방 시세 칸과 랜딩 티커가 같은 응답 하나를 나눠 쓴다
 * (`use-market-price.ts`). 코인이 스무 개 남짓이라 묶어도 응답이 작다.
 */

const ENDPOINT = "https://api.coingecko.com/api/v3/simple/price";

/** 원화 시세 한 건. */
export type MarketQuote = {
  /** 원화 가격. */
  price: number;
  /** 24시간 등락률(%). CoinGecko 가 안 주면 null. */
  change24h: number | null;
  /** CoinGecko 가 이 값을 갱신한 시각(ms). 없으면 null. */
  updatedAt: number | null;
};

/** 코인 기호 → 시세. 응답에 없거나 값이 이상한 코인은 빠진다. */
export type MarketQuotes = Record<string, MarketQuote>;

/** 호출 제한(429). 다른 실패와 달리 바로 다시 부르면 안 된다. */
export class PriceRateLimited extends Error {
  constructor() {
    super("CoinGecko 호출 제한에 걸렸습니다.");
    this.name = "PriceRateLimited";
  }
}

export async function fetchMarketQuotes(signal?: AbortSignal): Promise<MarketQuotes> {
  const query = new URLSearchParams({
    ids: Object.values(MARKET_COINS)
      .map((coin) => coin.geckoId)
      .join(","),
    vs_currencies: "krw",
    include_24hr_change: "true",
    include_last_updated_at: "true",
  });

  const response = await fetch(`${ENDPOINT}?${query}`, {
    signal,
    credentials: "omit",
    // 응답에 max-age=30 이 붙어 온다. 갱신 주기(30초)에 브라우저 캐시를 그대로 받으면
    // 최대 30초 묵은 값이 된다. 서버에 확인하고 받는다.
    cache: "no-cache",
  });

  if (response.status === 429) throw new PriceRateLimited();
  if (!response.ok) throw new Error(`CoinGecko 시세 요청 실패 (${response.status})`);

  return parseMarketQuotes(await response.json());
}

/** `/simple/price` 응답 → 코인 기호별 시세. */
export function parseMarketQuotes(body: unknown): MarketQuotes {
  const quotes: MarketQuotes = {};
  if (!isRecord(body)) return quotes;

  for (const [symbol, coin] of Object.entries(MARKET_COINS)) {
    const entry = body[coin.geckoId];
    if (!isRecord(entry)) continue;

    const price = entry.krw;
    if (!isFiniteNumber(price) || price <= 0) continue;

    const change = entry.krw_24h_change;
    const updated = entry.last_updated_at;

    quotes[symbol] = {
      price,
      change24h: isFiniteNumber(change) ? change : null,
      updatedAt: isFiniteNumber(updated) ? updated * 1000 : null,
    };
  }

  return quotes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
