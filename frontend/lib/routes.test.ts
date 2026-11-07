import { describe, expect, it } from "vitest";
import { parseMemberId, profileHref } from "./routes";

describe("profileHref", () => {
  it("회원 id 만으로 주소를 만든다", () => {
    expect(profileHref(7)).toBe("/user/7");
  });

  it("글 탭 · 1쪽은 주소에 적지 않는다", () => {
    expect(profileHref(7, { tab: "posts", page: 1 })).toBe("/user/7");
  });

  it("댓글 탭과 쪽 번호를 싣는다", () => {
    expect(profileHref(7, { tab: "comments", page: 3 })).toBe("/user/7?tab=comments&page=3");
    expect(profileHref(7, { page: 2 })).toBe("/user/7?page=2");
  });
});

describe("parseMemberId", () => {
  it("1 이상의 정수 숫자만 받는다", () => {
    expect(parseMemberId("7")).toBe(7);
    expect(parseMemberId("1024")).toBe(1024);
  });

  it.each(["", "0", "007", "-1", "1.0", "1e3", "abc", "@고래", " 7", "99999999999999999999"])(
    "%j 는 회원 id 가 아니다",
    (value) => {
      expect(parseMemberId(value)).toBeNull();
    },
  );

  it("값이 없으면 null", () => {
    expect(parseMemberId(undefined)).toBeNull();
  });
});
