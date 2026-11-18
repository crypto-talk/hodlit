import { MARKET_COINS } from "./coins";
import { isFiniteNumber, isRecord, type MarketQuotes, PriceRateLimited } from "./quote";

/**
 * 빗썸 현재가 직접 호출.
 *
 * 방 대문 차트(TradingView)도 빗썸 원화 마켓이라, 시세 칸과 숫자가 맞는다. CoinGecko 원화
 * 환산값은 해외 시세라 국내 거래소와 1~2% 다르다(김치 프리미엄). 그래서 빗썸에 원화 마켓이
 * 있는 코인은 여기서 받는다.
 *
 * 예전에는 업비트였다(HODL-61, 2026-10-18). 업비트는 Origin 헤더가 있는 요청(= 브라우저)을
 * **10초당 1회**로 제한해서, 탭을 여러 개 열거나 같은 IP 에서 여럿이 보면 요청이 거절되고
 * 콘솔에 CORS 오류로 찍혔다. 빗썸 `/v1/ticker` 는 브라우저에서 연속으로 불러도 막히지 않았다
 * (2026-11-16 운영 사이트에서 0.2초 간격 5번 모두 200). 응답 모양은 업비트와 같다.
 *
 * 공개 시세 API 라 키가 없다. 요청 헤더도 붙이지 않는다(단순 GET, 사전 요청 없음).
 *
 * 등락률(`signed_change_rate`)은 24시간이 아니라 **전일 종가 대비**다. 빗썸의 하루 경계는
 * 한국 시간 0시로 보인다(누적 거래량이 KST 0시 기준). 업비트는 UTC 0시(오전 9시)였다.
 */

const ENDPOINT = "https://api.bithumb.com/v1/ticker";

/** 빗썸 원화 마켓이 있는 코인의 마켓 코드. `KRW-BTC` */
export const BITHUMB_MARKETS = Object.values(MARKET_COINS)
  .map((coin) => coin.bithumbMarket)
  .filter((market): market is string => market !== null);

export async function fetchBithumbQuotes(signal?: AbortSignal): Promise<MarketQuotes> {
  const query = new URLSearchParams({ markets: BITHUMB_MARKETS.join(",") });

  const response = await fetch(`${ENDPOINT}?${query}`, {
    signal,
    credentials: "omit",
    cache: "no-cache",
  });

  if (response.status === 429 || response.status === 418) throw new PriceRateLimited("bithumb");
  if (!response.ok) throw new Error(`빗썸 시세 요청 실패 (${response.status})`);

  return parseBithumbTickers(await response.json());
}

/** `/v1/ticker` 응답(배열) → 코인 기호별 시세. */
export function parseBithumbTickers(body: unknown): MarketQuotes {
  const quotes: MarketQuotes = {};
  if (!Array.isArray(body)) return quotes;

  const symbolOf = new Map(
    Object.entries(MARKET_COINS)
      .filter(([, coin]) => coin.bithumbMarket !== null)
      .map(([symbol, coin]) => [coin.bithumbMarket, symbol]),
  );

  for (const ticker of body) {
    if (!isRecord(ticker)) continue;

    const symbol = symbolOf.get(ticker.market as string);
    if (!symbol) continue;

    const price = ticker.trade_price;
    if (!isFiniteNumber(price) || price <= 0) continue;

    const rate = ticker.signed_change_rate;

    quotes[symbol] = {
      source: "bithumb",
      price,
      // 빗썸은 비율(0.0078)로 준다. 화면은 퍼센트(0.78)를 받는다.
      changeRate: isFiniteNumber(rate) ? rate * 100 : null,
      changeBasis: "prev-close",
      updatedAt: tradedAtOf(ticker),
    };
  }

  return quotes;
}

/**
 * 마지막 체결 시각(ms). `trade_date` · `trade_time` (UTC, `yyyyMMdd` · `HHmmss`)으로 만든다.
 *
 * ⚠️ 빗썸의 `trade_timestamp` 는 쓰지 않는다. 한국 시간 벽시계를 UTC 처럼 적은 값이라 9시간
 * 앞서 있다(2026-11-16 확인: 한국 22:09 체결이 `2026-11-16T22:09Z` 로 옴 → 화면에 "07:09 기준").
 * 업비트는 이 값이 맞았다.
 */
function tradedAtOf(ticker: Record<string, unknown>): number | null {
  const date = ticker.trade_date;
  const time = ticker.trade_time;
  if (typeof date !== "string" || !/^\d{8}$/.test(date)) return null;
  if (typeof time !== "string" || !/^\d{6}$/.test(time)) return null;

  const at = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6, 8)),
    Number(time.slice(0, 2)),
    Number(time.slice(2, 4)),
    Number(time.slice(4, 6)),
  );
  return Number.isFinite(at) ? at : null;
}
