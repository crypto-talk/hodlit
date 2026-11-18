/**
 * 코인 기호 → 외부 시세 식별자.
 *
 * 가격은 프론트가 직접 부른다(HODL-61). 빗썸에 원화 마켓이 있는 코인은 빗썸(`bithumbMarket`),
 * 없는 코인(LTC · TON)만 CoinGecko(`geckoId`)다. 2026-10-18 에 방 차트와 숫자를 맞추려고 업비트로
 * 바꿨다가, 업비트의 브라우저 요청 제한(10초당 1회) 때문에 2026-11-16 빗썸으로 옮겼다(`bithumb.ts`).
 * CoinGecko id 는 백엔드 `coins.market_price_id`
 * (`005-social-api-completion.sql` · `007-expand-coin-catalog.sql`) 값을 그대로 옮겼다.
 * 기호로 검색해 id 를 찾지 않는 이유: 같은 기호를 쓰는 코인이 많아 틀린 코인을 고를 수 있고,
 * 호출도 늘어난다.
 *
 * `tradingView` 는 방 차트(HODL-63)의 TradingView 심볼이다. 원화 시세와 맞추려고 빗썸 원화
 * 마켓을 먼저 쓰고, 빗썸에 원화 마켓이 없는 LTC 는 바이낸스 USDT 마켓을 쓴다. TON 은
 * TradingView 에 바이낸스 마켓이 없어("심볼이 존재하지 않습니다") OKX USDT 마켓을 쓴다.
 * 2026-11-16 빗썸 마켓 목록(`/v1/market/all`)과 TradingView 시세 조회로 빗썸 18개를 확인했다.
 *
 * 백엔드에 코인이 늘면 이 표에도 넣는다. 표에 없는 코인은 "시세 정보 없음"으로 보인다.
 * 백엔드 `/coins` 응답에 이 값들이 생기면 이 표는 지운다.
 */

export type MarketCoin = {
  /** 빗썸 원화 마켓 코드(`KRW-BTC`). 빗썸에 없으면 null 이고 시세는 CoinGecko 로 받는다. */
  bithumbMarket: string | null;
  /** CoinGecko `/simple/price` 의 `ids` 값. 빗썸에 없는 코인의 시세에 쓴다. */
  geckoId: string;
  /** TradingView 위젯 `symbol` 값. `거래소:마켓` */
  tradingView: string;
};

export const MARKET_COINS: Record<string, MarketCoin> = {
  BTC: { bithumbMarket: "KRW-BTC", geckoId: "bitcoin", tradingView: "BITHUMB:BTCKRW" },
  ETH: { bithumbMarket: "KRW-ETH", geckoId: "ethereum", tradingView: "BITHUMB:ETHKRW" },
  SOL: { bithumbMarket: "KRW-SOL", geckoId: "solana", tradingView: "BITHUMB:SOLKRW" },
  XRP: { bithumbMarket: "KRW-XRP", geckoId: "ripple", tradingView: "BITHUMB:XRPKRW" },
  DOGE: { bithumbMarket: "KRW-DOGE", geckoId: "dogecoin", tradingView: "BITHUMB:DOGEKRW" },
  ADA: { bithumbMarket: "KRW-ADA", geckoId: "cardano", tradingView: "BITHUMB:ADAKRW" },
  BNB: { bithumbMarket: "KRW-BNB", geckoId: "binancecoin", tradingView: "BITHUMB:BNBKRW" },
  AVAX: { bithumbMarket: "KRW-AVAX", geckoId: "avalanche-2", tradingView: "BITHUMB:AVAXKRW" },
  DOT: { bithumbMarket: "KRW-DOT", geckoId: "polkadot", tradingView: "BITHUMB:DOTKRW" },
  LINK: { bithumbMarket: "KRW-LINK", geckoId: "chainlink", tradingView: "BITHUMB:LINKKRW" },
  POL: {
    bithumbMarket: "KRW-POL",
    geckoId: "polygon-ecosystem-token",
    tradingView: "BITHUMB:POLKRW",
  },
  TON: { bithumbMarket: null, geckoId: "the-open-network", tradingView: "OKX:TONUSDT" },
  TRX: { bithumbMarket: "KRW-TRX", geckoId: "tron", tradingView: "BITHUMB:TRXKRW" },
  LTC: { bithumbMarket: null, geckoId: "litecoin", tradingView: "BINANCE:LTCUSDT" },
  BCH: { bithumbMarket: "KRW-BCH", geckoId: "bitcoin-cash", tradingView: "BITHUMB:BCHKRW" },
  UNI: { bithumbMarket: "KRW-UNI", geckoId: "uniswap", tradingView: "BITHUMB:UNIKRW" },
  AAVE: { bithumbMarket: "KRW-AAVE", geckoId: "aave", tradingView: "BITHUMB:AAVEKRW" },
  ATOM: { bithumbMarket: "KRW-ATOM", geckoId: "cosmos", tradingView: "BITHUMB:ATOMKRW" },
  NEAR: { bithumbMarket: "KRW-NEAR", geckoId: "near", tradingView: "BITHUMB:NEARKRW" },
  SUI: { bithumbMarket: "KRW-SUI", geckoId: "sui", tradingView: "BITHUMB:SUIKRW" },
};

export function marketCoinOf(symbol: string): MarketCoin | null {
  return MARKET_COINS[symbol.toUpperCase()] ?? null;
}
