import { describe, expect, it } from "vitest";
import { parseUpbitTickers, UPBIT_MARKETS } from "./upbit";

describe("parseUpbitTickers", () => {
  it("마켓 코드를 코인 기호로 바꾸고 등락률을 퍼센트로 맞춘다", () => {
    const quotes = parseUpbitTickers([
      {
        market: "KRW-BTC",
        trade_price: 110999000,
        signed_change_rate: 0.0078266159,
        trade_timestamp: 1792316169361,
      },
      { market: "KRW-POL", trade_price: 125 },
    ]);

    expect(quotes.BTC).toEqual({
      source: "upbit",
      price: 110999000,
      changeRate: 0.78266159,
      changeBasis: "prev-close",
      updatedAt: 1792316169361,
    });
    expect(quotes.POL).toEqual({
      source: "upbit",
      price: 125,
      changeRate: null,
      changeBasis: "prev-close",
      updatedAt: null,
    });
  });

  it("가격이 이상하거나 표에 없는 마켓은 빼고, 배열이 아니면 빈 결과", () => {
    expect(
      parseUpbitTickers([
        { market: "KRW-ETH", trade_price: "3214056" },
        { market: "KRW-SOL", trade_price: 0 },
        { market: "KRW-NOPE", trade_price: 1 },
        null,
      ]),
    ).toEqual({});
    expect(parseUpbitTickers({ error: { name: 404 } })).toEqual({});
  });

  it("업비트에 원화 마켓이 없는 BNB · LTC · TON 은 요청에 넣지 않는다", () => {
    expect(UPBIT_MARKETS).not.toContain("KRW-BNB");
    expect(UPBIT_MARKETS).not.toContain("KRW-LTC");
    expect(UPBIT_MARKETS).not.toContain("KRW-TON");
    expect(UPBIT_MARKETS).toContain("KRW-BTC");
  });
});
