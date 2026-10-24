import { MARKET_COINS } from "./coins";
import { isFiniteNumber, isRecord, type MarketQuotes, PriceRateLimited } from "./quote";

/**
 * 업비트 현재가 직접 호출.
 *
 * 방 대문 차트(TradingView)가 업비트 원화 마켓이라, 시세 칸도 같은 시장을 봐야 숫자가 맞는다.
 * CoinGecko 원화 환산값은 해외 시세라 업비트와 1~2% 다르다(김치 프리미엄). 그래서 업비트에
 * 원화 마켓이 있는 코인은 여기서 받는다(HODL-61, 2026-10-18 성지 결정 · Jira 코멘트).
 *
 * 공개 시세 API 라 키가 없다. 요청 헤더도 붙이지 않는다(단순 GET, 사전 요청 없음).
 *
 * ⚠️ 업비트는 Origin 헤더가 있는 요청(= 브라우저)을 **10초당 1회**로 제한하고, 반복해서 넘기면
 * 일시 차단(418)한다(docs.upbit.com 요청 수 제한 · 2024-07 공지). 갱신 주기는 그보다 길게
 * (`use-market-price.ts`, 30초), 원화 마켓 코인을 한 요청에 묶는다.
 *
 * 등락률(`signed_change_rate`)은 24시간이 아니라 **전일 종가 대비**다.
 */

const ENDPOINT = "https://api.upbit.com/v1/ticker";

/** 업비트 원화 마켓이 있는 코인의 마켓 코드. `KRW-BTC` */
export const UPBIT_MARKETS = Object.values(MARKET_COINS)
  .map((coin) => coin.upbitMarket)
  .filter((market): market is string => market !== null);

export async function fetchUpbitQuotes(signal?: AbortSignal): Promise<MarketQuotes> {
  const query = new URLSearchParams({ markets: UPBIT_MARKETS.join(",") });

  const response = await fetch(`${ENDPOINT}?${query}`, {
    signal,
    credentials: "omit",
    cache: "no-cache",
  });

  if (response.status === 429 || response.status === 418) throw new PriceRateLimited("upbit");
  if (!response.ok) throw new Error(`업비트 시세 요청 실패 (${response.status})`);

  return parseUpbitTickers(await response.json());
}

/** `/v1/ticker` 응답(배열) → 코인 기호별 시세. */
export function parseUpbitTickers(body: unknown): MarketQuotes {
  const quotes: MarketQuotes = {};
  if (!Array.isArray(body)) return quotes;

  const symbolOf = new Map(
    Object.entries(MARKET_COINS)
      .filter(([, coin]) => coin.upbitMarket !== null)
      .map(([symbol, coin]) => [coin.upbitMarket, symbol]),
  );

  for (const ticker of body) {
    if (!isRecord(ticker)) continue;

    const symbol = symbolOf.get(ticker.market as string);
    if (!symbol) continue;

    const price = ticker.trade_price;
    if (!isFiniteNumber(price) || price <= 0) continue;

    const rate = ticker.signed_change_rate;
    const tradedAt = ticker.trade_timestamp;

    quotes[symbol] = {
      source: "upbit",
      price,
      // 업비트는 비율(0.0078)로 준다. 화면은 퍼센트(0.78)를 받는다.
      changeRate: isFiniteNumber(rate) ? rate * 100 : null,
      changeBasis: "prev-close",
      updatedAt: isFiniteNumber(tradedAt) ? tradedAt : null,
    };
  }

  return quotes;
}
