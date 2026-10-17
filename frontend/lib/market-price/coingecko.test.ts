import { describe, expect, it } from "vitest";
import { parseMarketQuotes } from "./coingecko";

describe("parseMarketQuotes", () => {
  it("CoinGecko id 를 코인 기호로 바꾸고 갱신 시각을 ms 로 맞춘다", () => {
    const quotes = parseMarketQuotes({
      bitcoin: { krw: 108489011, krw_24h_change: -0.035, last_updated_at: 1792252651 },
      "polygon-ecosystem-token": { krw: 122.49 },
    });

    expect(quotes.BTC).toEqual({
      price: 108489011,
      change24h: -0.035,
      updatedAt: 1792252651000,
    });
    expect(quotes.POL).toEqual({ price: 122.49, change24h: null, updatedAt: null });
  });

  it("가격이 없거나 숫자가 아니거나 0 이하인 코인은 뺀다", () => {
    const quotes = parseMarketQuotes({
      bitcoin: { usd: 1 },
      ethereum: { krw: "3214056" },
      solana: { krw: 0 },
      ripple: { krw: Number.NaN },
    });

    expect(quotes).toEqual({});
  });

  it("표에 없는 id 는 무시하고, 이상한 응답은 빈 결과를 돌려준다", () => {
    expect(parseMarketQuotes({ "not-in-table": { krw: 1 } })).toEqual({});
    expect(parseMarketQuotes(null)).toEqual({});
    expect(parseMarketQuotes([])).toEqual({});
  });
});
