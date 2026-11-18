import { describe, expect, it } from "vitest";
import { toBanner } from "./api";

const raw = { id: 1, imageUrl: "/api/v1/media/a.png", altText: "ETH 방 오픈", displayOrder: 0 };

describe("toBanner", () => {
  it("링크 없는 배너는 link 가 null", () => {
    const [banner] = toBanner(raw);
    expect(banner.link).toBeNull();
    expect(banner.src.endsWith("/api/v1/media/a.png")).toBe(true);
    expect(banner.altText).toBe("ETH 방 오픈");
  });

  it("사이트 안 경로는 안쪽 링크, http(s) 는 바깥 링크", () => {
    expect(toBanner({ ...raw, linkUrl: "/subhodl/ETH" })[0].link).toEqual({
      href: "/subhodl/ETH",
      external: false,
    });
    expect(toBanner({ ...raw, linkUrl: "https://example.com/x" })[0].link).toEqual({
      href: "https://example.com/x",
      external: true,
    });
  });

  it("쓸 수 없는 링크는 빼고 배너는 그린다", () => {
    expect(toBanner({ ...raw, linkUrl: "javascript:alert(1)" })[0].link).toBeNull();
    expect(toBanner({ ...raw, linkUrl: "//evil.example" })[0].link).toBeNull();
  });

  it("이미지를 쓸 수 없으면 배너를 버린다", () => {
    expect(toBanner({ ...raw, imageUrl: "javascript:alert(1)" })).toEqual([]);
    expect(toBanner({ ...raw, imageUrl: undefined })).toEqual([]);
    expect(toBanner({ ...raw, id: undefined })).toEqual([]);
  });
});
