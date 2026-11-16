import { describe, expect, it } from "vitest";
import { BITHUMB_MARKETS, parseBithumbTickers } from "./bithumb";

describe("parseBithumbTickers", () => {
  it("마켓 코드를 코인 기호로 바꾸고 등락률을 퍼센트로 맞춘다", () => {
    const quotes = parseBithumbTickers([
      {
        market: "KRW-BTC",
        trade_price: 87832000,
        signed_change_rate: 0.0078266159,
        trade_timestamp: 1794836400000,
      },
      { market: "KRW-POL", trade_price: 107 },
    ]);

    expect(quotes.BTC).toEqual({
      source: "bithumb",
      price: 87832000,
      changeRate: 0.78266159,
      changeBasis: "prev-close",
      updatedAt: 1794836400000,
    });
    expect(quotes.POL).toEqual({
      source: "bithumb",
      price: 107,
      changeRate: null,
      changeBasis: "prev-close",
      updatedAt: null,
    });
  });

  it("가격이 이상하거나 표에 없는 마켓은 빼고, 배열이 아니면 빈 결과", () => {
    expect(
      parseBithumbTickers([
        { market: "KRW-ETH", trade_price: "2459000" },
        { market: "KRW-SOL", trade_price: 0 },
        { market: "KRW-NOPE", trade_price: 1 },
        null,
      ]),
    ).toEqual({});
    expect(parseBithumbTickers({ error: { name: 404 } })).toEqual({});
  });

  it("빗썸에 원화 마켓이 없는 LTC · TON 은 요청에 넣지 않고, BNB 는 넣는다", () => {
    expect(BITHUMB_MARKETS).not.toContain("KRW-LTC");
    expect(BITHUMB_MARKETS).not.toContain("KRW-TON");
    expect(BITHUMB_MARKETS).toContain("KRW-BNB");
    expect(BITHUMB_MARKETS).toContain("KRW-BTC");
  });
});
