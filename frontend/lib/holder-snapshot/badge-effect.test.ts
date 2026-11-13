import { describe, expect, it } from "vitest";
import { effectAt } from "./badge-effect";

describe("effectAt", () => {
  it("글 상세는 설정한 효과 그대로", () => {
    expect(effectAt("detail", "aurora")).toBe("aurora");
    expect(effectAt("detail", "soft")).toBe("soft");
  });

  it("목록 · 댓글에서는 움직이는 효과를 테두리로 낮춘다", () => {
    expect(effectAt("list", "aurora")).toBe("border");
    expect(effectAt("list", "flow")).toBe("border");
    expect(effectAt("comment", "shine")).toBe("border");
  });

  it("목록 · 댓글에서도 움직이지 않는 효과는 그대로", () => {
    expect(effectAt("list", "soft")).toBe("soft");
    expect(effectAt("comment", "border")).toBe("border");
    expect(effectAt("list", "none")).toBe("none");
  });

  it("모르는 값 · 빈 값은 효과 없음", () => {
    expect(effectAt("detail", "sparkle; x")).toBe("none");
    expect(effectAt("detail", undefined)).toBe("none");
    expect(effectAt("list", null)).toBe("none");
  });
});
