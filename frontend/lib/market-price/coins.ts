/**
 * 코인 기호 → 외부 시세 식별자.
 *
 * 가격은 프론트가 CoinGecko 를 직접 부른다(HODL-61). 그래서 백엔드 `coins.market_price_id`
 * 와 같은 표가 프론트에도 필요하다. CoinGecko id 는 백엔드 마이그레이션
 * `005-social-api-completion.sql` · `007-expand-coin-catalog.sql` 값을 그대로 옮겼다.
 * 기호로 CoinGecko 를 검색해 id 를 찾지 않는 이유: 같은 기호를 쓰는 코인이 많아 틀린 코인을
 * 고를 수 있고, 호출도 늘어난다.
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
  /** CoinGecko `/simple/price` 의 `ids` 값. */
  geckoId: string;
  /** TradingView 위젯 `symbol` 값. `거래소:마켓` */
  tradingView: string;
};

export const MARKET_COINS: Record<string, MarketCoin> = {
  BTC: { geckoId: "bitcoin", tradingView: "UPBIT:BTCKRW" },
  ETH: { geckoId: "ethereum", tradingView: "UPBIT:ETHKRW" },
  SOL: { geckoId: "solana", tradingView: "UPBIT:SOLKRW" },
  XRP: { geckoId: "ripple", tradingView: "UPBIT:XRPKRW" },
  DOGE: { geckoId: "dogecoin", tradingView: "UPBIT:DOGEKRW" },
  ADA: { geckoId: "cardano", tradingView: "UPBIT:ADAKRW" },
  BNB: { geckoId: "binancecoin", tradingView: "BINANCE:BNBUSDT" },
  AVAX: { geckoId: "avalanche-2", tradingView: "UPBIT:AVAXKRW" },
  DOT: { geckoId: "polkadot", tradingView: "UPBIT:DOTKRW" },
  LINK: { geckoId: "chainlink", tradingView: "UPBIT:LINKKRW" },
  POL: { geckoId: "polygon-ecosystem-token", tradingView: "UPBIT:POLKRW" },
  TON: { geckoId: "the-open-network", tradingView: "OKX:TONUSDT" },
  TRX: { geckoId: "tron", tradingView: "UPBIT:TRXKRW" },
  LTC: { geckoId: "litecoin", tradingView: "BINANCE:LTCUSDT" },
  BCH: { geckoId: "bitcoin-cash", tradingView: "UPBIT:BCHKRW" },
  UNI: { geckoId: "uniswap", tradingView: "UPBIT:UNIKRW" },
  AAVE: { geckoId: "aave", tradingView: "UPBIT:AAVEKRW" },
  ATOM: { geckoId: "cosmos", tradingView: "UPBIT:ATOMKRW" },
  NEAR: { geckoId: "near", tradingView: "UPBIT:NEARKRW" },
  SUI: { geckoId: "sui", tradingView: "UPBIT:SUIKRW" },
};

export function marketCoinOf(symbol: string): MarketCoin | null {
  return MARKET_COINS[symbol.toUpperCase()] ?? null;
}
