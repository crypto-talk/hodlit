import { describe, expect, it } from "vitest";
import { safeExternalUrl, safeLink, safeSitePath } from "./safe-url";

describe("safeExternalUrl", () => {
  it("http(s) 만 받는다", () => {
    expect(safeExternalUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,x")).toBeNull();
    expect(safeExternalUrl("/subhodl/ETH")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
  });

  it("계정 정보가 든 주소는 받지 않는다", () => {
    expect(safeExternalUrl("https://user:pass@example.com")).toBeNull();
  });
});

describe("safeSitePath", () => {
  it("사이트 안 경로만 받는다", () => {
    expect(safeSitePath("/subhodl/ETH")).toBe("/subhodl/ETH");
    expect(safeSitePath("//evil.example")).toBeNull();
    expect(safeSitePath("/\\evil.example")).toBeNull();
    expect(safeSitePath("subhodl/ETH")).toBeNull();
    expect(safeSitePath("/a\nb")).toBeNull();
    expect(safeSitePath(null)).toBeNull();
  });
});

describe("safeLink", () => {
  it("안쪽 · 바깥을 가른다", () => {
    expect(safeLink("/draw/1")).toEqual({ href: "/draw/1", external: false });
    expect(safeLink("https://example.com/")).toEqual({
      href: "https://example.com/",
      external: true,
    });
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink(undefined)).toBeNull();
  });
});
