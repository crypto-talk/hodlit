import { describe, expect, it } from "vitest";
import { SLICE_LIMIT, toPortfolio } from "./api";

/**
 * 비중이 틀려도 차트는 멀쩡히 그려진다. 그래서 숫자를 여기서 확인한다.
 */
describe("toPortfolio", () => {
  it("지갑도 거래소도 없으면 미연결", () => {
    const portfolio = toPortfolio({ walletCount: 0, exchangeCount: 0, assets: [] });
    expect(portfolio.connected).toBe(false);
    expect(portfolio.slices).toEqual([]);
  });

  it("원화 평가금액 기준으로 비중을 계산하고 큰 순으로 놓는다", () => {
    const portfolio = toPortfolio({
      walletCount: 1,
      exchangeCount: 1,
      assets: [
        { symbol: "ETH", quantity: 1, valueKrw: 3_000_000, syncStatus: "READY" },
        { symbol: "BTC", quantity: 0.1, valueKrw: 9_000_000, syncStatus: "READY" },
      ],
      unresolvedAssets: [],
    });

    expect(portfolio.totalKrw).toBe(12_000_000);
    expect(portfolio.holdings.map((h) => [h.symbol, h.share])).toEqual([
      ["BTC", 0.75],
      ["ETH", 0.25],
    ]);
    expect(portfolio.slices.map((s) => s.colorSlot)).toEqual([0, 1]);
    expect(portfolio.slices[0].label).toBe("비트코인");
  });

  it(`${SLICE_LIMIT}개를 넘으면 나머지를 기타 한 조각으로 묶는다`, () => {
    const symbols = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "DOT"];
    const portfolio = toPortfolio({
      walletCount: 1,
      assets: symbols.map((symbol, index) => ({
        symbol,
        quantity: 1,
        valueKrw: (symbols.length - index) * 100,
        syncStatus: "READY",
      })),
    });

    expect(portfolio.slices).toHaveLength(SLICE_LIMIT + 1);
    const other = portfolio.slices[SLICE_LIMIT];
    expect(other.colorSlot).toBeNull();
    expect(other.detail).toBe("ADA · DOT");
    expect(other.valueKrw).toBe(300);
    const shareSum = portfolio.slices.reduce((sum, s) => sum + s.share, 0);
    expect(shareSum).toBeCloseTo(1);
  });

  it("평가금액이 없는 코인은 비중에서 빼고 이유를 남긴다", () => {
    const portfolio = toPortfolio({
      walletCount: 1,
      exchangeCount: 1,
      assets: [
        { symbol: "ETH", quantity: 2, valueKrw: 6_000_000, syncStatus: "READY" },
        { symbol: "BTC", quantity: 0.5, syncStatus: "PARTIAL" },
        { symbol: "SUI", quantity: 10, syncStatus: "PRICE_UNAVAILABLE" },
      ],
      unresolvedAssets: [{ symbol: "BTC", syncStatus: "PARTIAL" }],
    });

    expect(portfolio.holdings.map((h) => h.symbol)).toEqual(["ETH"]);
    expect(portfolio.holdings[0].share).toBe(1);
    expect(portfolio.unpriced.map((h) => [h.symbol, h.reason])).toEqual([
      ["BTC", "partial"],
      ["SUI", "price"],
    ]);
    expect(portfolio.incomplete).toEqual(["BTC"]);
  });

  it("음수 · 숫자 아닌 값은 버리고, 문자열 숫자는 읽는다", () => {
    const portfolio = toPortfolio({
      walletCount: 1,
      assets: [
        { symbol: "ETH", quantity: "1.5", valueKrw: "4500000" },
        { symbol: "BTC", quantity: -1, valueKrw: 100 },
        { symbol: "SOL", quantity: 1, valueKrw: Number.NaN },
        { quantity: 1, valueKrw: 100 },
      ],
    });

    expect(portfolio.holdings.map((h) => [h.symbol, h.quantity, h.valueKrw])).toEqual([
      ["ETH", 1.5, 4_500_000],
    ]);
    expect(portfolio.unpriced.map((h) => h.symbol)).toEqual(["SOL"]);
  });

  it("가장 최근 확인 시각을 고른다", () => {
    const portfolio = toPortfolio({
      walletCount: 1,
      assets: [
        { symbol: "ETH", quantity: 1, valueKrw: 1, capturedAt: "2026-10-22T10:00:00Z" },
        { symbol: "BTC", quantity: 1, valueKrw: 1, capturedAt: "2026-10-22T10:05:00Z" },
      ],
    });
    expect(portfolio.capturedAt).toBe("2026-10-22T10:05:00Z");
  });
});
