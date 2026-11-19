import { beforeEach, expect, it, vi } from "vitest";
import { http } from "@/lib/http";
import { loadRoomNews } from "./api";
import { loadArticleCover } from "./article-cover";
import { publishedHomeNews } from "./home-news.server";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/http", () => ({ http: vi.fn() }));
vi.mock("./api", () => ({ loadRoomNews: vi.fn() }));
vi.mock("./article-cover", () => ({ loadArticleCover: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

it("returns no cards without open news rooms", async () => {
  vi.mocked(http).mockResolvedValue([
    { symbol: "OTHER" },
    { symbol: "ETH", operationStatus: "CLOSE" },
  ]);
  expect(await publishedHomeNews()).toEqual([]);
  expect(loadRoomNews).not.toHaveBeenCalled();
});

it("merges recent registered stories across rooms even if one room or cover is unavailable", async () => {
  vi.mocked(http).mockResolvedValue([{ symbol: "ETH" }, { symbol: "BTC" }, { symbol: "SOL" }]);
  vi.mocked(loadRoomNews).mockImplementation(async (symbol) => {
    if (symbol === "SOL") throw new Error("unavailable");
    const ids = symbol === "BTC" ? [5, 3, 1] : [4, 2];
    const items = ids.map((id) => ({
      id,
      title: `기사 ${id}`,
      summary: `등록 본문 ${id}`,
      sourceName: "매체",
      sourceUrl: `https://news.example/${id}`,
      createdAt: "2026-11-01T00:00:00Z",
    }));
    return { items, page: 1, totalItems: ids.length, totalPages: 1 };
  });
  vi.mocked(loadArticleCover).mockResolvedValue(null);
  const cards = await publishedHomeNews();
  expect(cards.map(({ id }) => id)).toEqual([5, 4, 3, 2]);
  expect(cards[0]).toMatchObject({ symbol: "BTC", summary: "등록 본문 5", cover: null });
  expect(loadArticleCover).toHaveBeenCalledTimes(4);
});
