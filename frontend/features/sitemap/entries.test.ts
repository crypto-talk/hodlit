import { describe, expect, it } from "vitest";
import { sitemapEntries } from "./entries";

const ORIGIN = "https://hodlit.xyz";

describe("sitemapEntries", () => {
  it("홈 → 방 → 글 순서로, 글은 글이 속한 방 주소로 넣는다", () => {
    const entries = sitemapEntries(
      ORIGIN,
      ["BTC", "OTHER"],
      [
        { id: 18, symbol: "ETH", updatedAt: "2026-11-13T00:00:00Z" },
        { id: 17, symbol: "BTC", updatedAt: "2026-11-12T00:00:00Z" },
      ],
    );

    expect(entries.map((entry) => entry.url)).toEqual([
      "https://hodlit.xyz/",
      "https://hodlit.xyz/subhodl/BTC",
      "https://hodlit.xyz/subhodl/OTHER",
      "https://hodlit.xyz/subhodl/ETH/18",
      "https://hodlit.xyz/subhodl/BTC/17",
    ]);
  });

  it("홈과 방의 수정 시각은 그 안에서 가장 최근 글의 시각이다", () => {
    const entries = sitemapEntries(
      ORIGIN,
      ["BTC", "SOL"],
      [
        { id: 3, symbol: "BTC", updatedAt: "2026-11-10T00:00:00Z" },
        { id: 2, symbol: "BTC", updatedAt: "2026-11-12T00:00:00Z" },
        { id: 1, symbol: "ETH", updatedAt: "2026-11-13T00:00:00Z" },
      ],
    );
    const byUrl = new Map(entries.map((entry) => [entry.url, entry.lastModified]));

    expect(byUrl.get(`${ORIGIN}/`)).toEqual(new Date("2026-11-13T00:00:00Z"));
    expect(byUrl.get(`${ORIGIN}/subhodl/BTC`)).toEqual(new Date("2026-11-12T00:00:00Z"));
    // 글이 없는 방은 시각을 적지 않는다.
    expect(byUrl.get(`${ORIGIN}/subhodl/SOL`)).toBeUndefined();
  });

  it("시각이 없거나 깨졌으면 그 줄만 시각을 뺀다", () => {
    const entries = sitemapEntries(
      ORIGIN,
      [],
      [
        { id: 2, symbol: "BTC", updatedAt: null },
        { id: 1, symbol: "BTC", updatedAt: "not-a-date" },
      ],
    );

    expect(entries.map((entry) => entry.lastModified)).toEqual([undefined, undefined, undefined]);
  });

  it("방도 글도 못 받으면 홈만 남는다", () => {
    expect(sitemapEntries(ORIGIN, [], [])).toEqual([
      { url: `${ORIGIN}/`, lastModified: undefined },
    ]);
  });
});
