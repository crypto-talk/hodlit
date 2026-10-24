import { describe, expect, it } from "vitest";
import { safeExternalUrl, toNewsItem } from "./api";

describe("safeExternalUrl", () => {
  it("http(s) 만 통과한다", () => {
    expect(safeExternalUrl("https://cointelegraph.com/news/a")).toBe(
      "https://cointelegraph.com/news/a",
    );
    expect(safeExternalUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("스크립트 · 상대 경로 · 계정 정보가 든 주소는 막는다", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("/news/1")).toBeNull();
    expect(safeExternalUrl("https://user:pw@example.com/")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});

describe("toNewsItem", () => {
  it("제목이 없으면 버린다", () => {
    expect(toNewsItem({ id: 1, title: "" })).toBeNull();
    expect(toNewsItem({ title: "제목" })).toBeNull();
  });

  it("원문 주소가 위험하면 링크 없이 남긴다", () => {
    const item = toNewsItem({ id: 1, title: "제목", sourceUrl: "javascript:alert(1)" });
    expect(item?.sourceUrl).toBeNull();
    expect(item?.title).toBe("제목");
  });
});
