import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({ config: { apiUrl: "https://api.test" } }));

const { toPostSummary } = await import("./post-summary");

const base = { id: 1, coinSymbol: "ETH", title: "글", content: "본문" };

describe("toPostSummary — 첨부 미디어 (HODL-127)", () => {
  it("사진은 순서대로, 백엔드 주소를 붙여서", () => {
    const summary = toPostSummary({
      ...base,
      media: [
        { id: 2, type: "IMAGE", url: "/api/v1/media/b.png", order: 1 },
        { id: 1, type: "IMAGE", url: "/api/v1/media/a.png", order: 0 },
        { id: 3, type: "VIDEO", url: "/api/v1/media/c.mp4", order: 2 },
        { id: 4, type: "IMAGE", url: "javascript:alert(1)", order: 3 },
      ],
    });
    expect(summary.images).toEqual([
      { id: "1", src: "https://api.test/api/v1/media/a.png" },
      { id: "2", src: "https://api.test/api/v1/media/b.png" },
    ]);
  });

  it("유튜브 영상 id 는 11자 모양일 때만", () => {
    expect(toPostSummary({ ...base, youtube: { videoId: "dQw4w9WgXcQ" } }).videoId).toBe(
      "dQw4w9WgXcQ",
    );
    expect(toPostSummary({ ...base, youtube: { videoId: "x/../y" } }).videoId).toBeNull();
  });

  it("첨부가 없으면 빈 목록 · null", () => {
    const summary = toPostSummary(base);
    expect(summary.images).toEqual([]);
    expect(summary.videoId).toBeNull();
  });
});
