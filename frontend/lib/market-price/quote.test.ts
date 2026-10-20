import { describe, expect, it } from "vitest";
import { type MarketQuote, orderQuotes } from "./quote";

const quote = (price: number): MarketQuote => ({
  source: "upbit",
  price,
  changeRate: null,
  changeBasis: "prev-close",
  updatedAt: null,
});

describe("orderQuotes", () => {
  it("응답 순서가 아니라 코인 표 순서로 줄 세우고, 응답에 없는 코인은 뺀다", () => {
    const ordered = orderQuotes({ XRP: quote(1750), BTC: quote(111056000), ETH: quote(3214000) });

    expect(ordered.map((item) => item.symbol)).toEqual(["BTC", "ETH", "XRP"]);
    expect(ordered[0].quote.price).toBe(111056000);
  });

  it("표에 없는 기호는 버리고, 빈 응답이면 빈 배열", () => {
    expect(orderQuotes({ NOPE: quote(1) })).toEqual([]);
    expect(orderQuotes({})).toEqual([]);
  });
});
