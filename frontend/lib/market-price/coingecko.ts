import { MARKET_COINS } from "./coins";
import { isFiniteNumber, isRecord, type MarketQuotes, PriceRateLimited } from "./quote";

/**
 * CoinGecko 시세 직접 호출 (HODL-61).
 *
 * 업비트에 원화 마켓이 없는 코인(BNB · LTC · TON)만 여기서 받는다. 나머지는 `upbit.ts`.
 * 백엔드 `MarketPriceService` 와 같은 `/simple/price`, 키 없음, 원화 · 24시간 등락률 · 갱신 시각.
 *
 * 비밀 키를 쓰지 않는다. 키 없는 공개 API 라 프론트 번들에 넣을 값이 없다.
 * 요청 헤더도 붙이지 않는다 — 단순 GET 이라 CORS 사전 요청(preflight)이 생기지 않는다.
 *
 * 키 없는 API 의 값은 약 60초마다 바뀌고 한도는 IP당 분당 약 10~30회다(docs.coingecko.com).
 */

const ENDPOINT = "https://api.coingecko.com/api/v3/simple/price";

/** 업비트에 없어서 CoinGecko 로 받는 코인의 기호. */
export const GECKO_SYMBOLS = Object.entries(MARKET_COINS)
  .filter(([, coin]) => coin.upbitMarket === null)
  .map(([symbol]) => symbol);

export async function fetchGeckoQuotes(signal?: AbortSignal): Promise<MarketQuotes> {
  const query = new URLSearchParams({
    ids: GECKO_SYMBOLS.map((symbol) => MARKET_COINS[symbol].geckoId).join(","),
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

  if (response.status === 429) throw new PriceRateLimited("coingecko");
  if (!response.ok) throw new Error(`CoinGecko 시세 요청 실패 (${response.status})`);

  return parseGeckoQuotes(await response.json());
}

/** `/simple/price` 응답 → 코인 기호별 시세. CoinGecko 로 받기로 한 코인만 남긴다. */
export function parseGeckoQuotes(body: unknown): MarketQuotes {
  const quotes: MarketQuotes = {};
  if (!isRecord(body)) return quotes;

  for (const symbol of GECKO_SYMBOLS) {
    const entry = body[MARKET_COINS[symbol].geckoId];
    if (!isRecord(entry)) continue;

    const price = entry.krw;
    if (!isFiniteNumber(price) || price <= 0) continue;

    const change = entry.krw_24h_change;
    const updated = entry.last_updated_at;

    quotes[symbol] = {
      source: "coingecko",
      price,
      changeRate: isFiniteNumber(change) ? change : null,
      changeBasis: "24h",
      updatedAt: isFiniteNumber(updated) ? updated * 1000 : null,
    };
  }

  return quotes;
}
