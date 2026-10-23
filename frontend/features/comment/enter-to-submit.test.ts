import type { KeyboardEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSubmitEnter } from "./enter-to-submit";

function key(
  init: Partial<{ key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }>,
) {
  return {
    key: init.key ?? "Enter",
    shiftKey: init.shiftKey ?? false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    keyCode: init.keyCode ?? 13,
    nativeEvent: { isComposing: init.isComposing ?? false },
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
}

function pointer(coarse: boolean) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: coarse }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSubmitEnter", () => {
  it("Enter 는 보내고 Shift+Enter 는 줄바꿈이다", () => {
    pointer(false);
    expect(isSubmitEnter(key({}))).toBe(true);
    expect(isSubmitEnter(key({ shiftKey: true }))).toBe(false);
  });

  it("한글 조합 중 Enter 는 보내지 않는다", () => {
    pointer(false);
    expect(isSubmitEnter(key({ isComposing: true }))).toBe(false);
    expect(isSubmitEnter(key({ keyCode: 229 }))).toBe(false);
  });

  it("터치 기기에서는 Enter 가 줄바꿈이다", () => {
    pointer(true);
    expect(isSubmitEnter(key({}))).toBe(false);
  });

  it("다른 키는 보내지 않는다", () => {
    pointer(false);
    expect(isSubmitEnter(key({ key: "a" }))).toBe(false);
  });
});
