import { describe, expect, it } from "vitest";
import { GECKO_SYMBOLS, parseGeckoQuotes } from "./coingecko";

describe("parseGeckoQuotes", () => {
  it("CoinGecko id 를 코인 기호로 바꾸고 갱신 시각을 ms 로 맞춘다", () => {
    const quotes = parseGeckoQuotes({
      "the-open-network": { krw: 2310, krw_24h_change: -1.2, last_updated_at: 1792252651 },
      litecoin: { krw: 84000 },
    });

    expect(quotes.TON).toEqual({
      source: "coingecko",
      price: 2310,
      changeRate: -1.2,
      changeBasis: "24h",
      updatedAt: 1792252651000,
    });
    expect(quotes.LTC).toEqual({
      source: "coingecko",
      price: 84000,
      changeRate: null,
      changeBasis: "24h",
      updatedAt: null,
    });
  });

  it("빗썸으로 받는 코인은 응답에 있어도 버린다", () => {
    expect(parseGeckoQuotes({ bitcoin: { krw: 108489011 }, binancecoin: { krw: 953119 } })).toEqual(
      {},
    );
  });

  it("가격이 없거나 숫자가 아니거나 0 이하면 빼고, 이상한 응답은 빈 결과", () => {
    expect(
      parseGeckoQuotes({
        "the-open-network": { usd: 1 },
        litecoin: { krw: "84000" },
      }),
    ).toEqual({});
    expect(parseGeckoQuotes({ litecoin: { krw: 0 } })).toEqual({});
    expect(parseGeckoQuotes(null)).toEqual({});
    expect(parseGeckoQuotes([])).toEqual({});
  });

  it("CoinGecko 로 받는 코인은 빗썸에 원화 마켓이 없는 둘뿐", () => {
    expect([...GECKO_SYMBOLS].sort()).toEqual(["LTC", "TON"]);
  });
});
