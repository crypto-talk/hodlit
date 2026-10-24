/**
 * 코인 기호 → 외부 시세 식별자.
 *
 * 가격은 프론트가 직접 부른다(HODL-61). 업비트에 원화 마켓이 있는 코인은 업비트(`upbitMarket`),
 * 없는 코인(BNB · LTC · TON)만 CoinGecko(`geckoId`)다 — 방 차트가 업비트라 숫자를 맞추려고
 * 2026-10-18 업비트로 바꿨다. CoinGecko id 는 백엔드 `coins.market_price_id`
 * (`005-social-api-completion.sql` · `007-expand-coin-catalog.sql`) 값을 그대로 옮겼다.
 * 기호로 검색해 id 를 찾지 않는 이유: 같은 기호를 쓰는 코인이 많아 틀린 코인을 고를 수 있고,
 * 호출도 늘어난다.
 *
 * `tradingView` 는 방 차트(HODL-63)의 TradingView 심볼이다. 원화 시세와 맞추려고 업비트 원화
 * 마켓을 먼저 쓰고, 업비트에 원화 마켓이 없는 BNB · LTC 는 바이낸스 USDT 마켓을 쓴다. TON 은
 * TradingView 에 바이낸스 마켓이 없어("심볼이 존재하지 않습니다") OKX USDT 마켓을 쓴다.
 * 2026-10-18 업비트 마켓 목록과 TradingView 위젯으로 스무 개 모두 확인했다.
 *
 * 백엔드에 코인이 늘면 이 표에도 넣는다. 표에 없는 코인은 "시세 정보 없음"으로 보인다.
 * 백엔드 `/coins` 응답에 이 값들이 생기면 이 표는 지운다.
 */

export type MarketCoin = {
  /** 업비트 원화 마켓 코드(`KRW-BTC`). 업비트에 없으면 null 이고 시세는 CoinGecko 로 받는다. */
  upbitMarket: string | null;
  /** CoinGecko `/simple/price` 의 `ids` 값. 업비트에 없는 코인의 시세에 쓴다. */
  geckoId: string;
  /** TradingView 위젯 `symbol` 값. `거래소:마켓` */
  tradingView: string;
};

export const MARKET_COINS: Record<string, MarketCoin> = {
  BTC: { upbitMarket: "KRW-BTC", geckoId: "bitcoin", tradingView: "UPBIT:BTCKRW" },
  ETH: { upbitMarket: "KRW-ETH", geckoId: "ethereum", tradingView: "UPBIT:ETHKRW" },
  SOL: { upbitMarket: "KRW-SOL", geckoId: "solana", tradingView: "UPBIT:SOLKRW" },
  XRP: { upbitMarket: "KRW-XRP", geckoId: "ripple", tradingView: "UPBIT:XRPKRW" },
  DOGE: { upbitMarket: "KRW-DOGE", geckoId: "dogecoin", tradingView: "UPBIT:DOGEKRW" },
  ADA: { upbitMarket: "KRW-ADA", geckoId: "cardano", tradingView: "UPBIT:ADAKRW" },
  BNB: { upbitMarket: null, geckoId: "binancecoin", tradingView: "BINANCE:BNBUSDT" },
  AVAX: { upbitMarket: "KRW-AVAX", geckoId: "avalanche-2", tradingView: "UPBIT:AVAXKRW" },
  DOT: { upbitMarket: "KRW-DOT", geckoId: "polkadot", tradingView: "UPBIT:DOTKRW" },
  LINK: { upbitMarket: "KRW-LINK", geckoId: "chainlink", tradingView: "UPBIT:LINKKRW" },
  POL: { upbitMarket: "KRW-POL", geckoId: "polygon-ecosystem-token", tradingView: "UPBIT:POLKRW" },
  TON: { upbitMarket: null, geckoId: "the-open-network", tradingView: "OKX:TONUSDT" },
  TRX: { upbitMarket: "KRW-TRX", geckoId: "tron", tradingView: "UPBIT:TRXKRW" },
  LTC: { upbitMarket: null, geckoId: "litecoin", tradingView: "BINANCE:LTCUSDT" },
  BCH: { upbitMarket: "KRW-BCH", geckoId: "bitcoin-cash", tradingView: "UPBIT:BCHKRW" },
  UNI: { upbitMarket: "KRW-UNI", geckoId: "uniswap", tradingView: "UPBIT:UNIKRW" },
  AAVE: { upbitMarket: "KRW-AAVE", geckoId: "aave", tradingView: "UPBIT:AAVEKRW" },
  ATOM: { upbitMarket: "KRW-ATOM", geckoId: "cosmos", tradingView: "UPBIT:ATOMKRW" },
  NEAR: { upbitMarket: "KRW-NEAR", geckoId: "near", tradingView: "UPBIT:NEARKRW" },
  SUI: { upbitMarket: "KRW-SUI", geckoId: "sui", tradingView: "UPBIT:SUIKRW" },
};

export function marketCoinOf(symbol: string): MarketCoin | null {
  return MARKET_COINS[symbol.toUpperCase()] ?? null;
}
