import { describe, expect, it } from "vitest";
import { searchHref } from "@/lib/routes";
import { toSearchResult } from "./api";
import { highlightParts } from "./highlight";
import { searchProblem } from "./limits";

describe("toSearchResult", () => {
  it("글은 본문 Markdown 기호를 걷어내고 글 상세로 간다", () => {
    expect(
      toSearchResult({
        type: "POST",
        id: 4,
        label: "ETH 흐름",
        excerpt: "## 요약\n**지지선** 위",
        authorNickname: "호들러",
        roomSymbol: "eth",
        postId: 4,
        createdAt: "2026-10-23T00:00:00Z",
      }),
    ).toMatchObject({
      kind: "post",
      key: "POST-4",
      postId: 4,
      symbol: "ETH",
      excerpt: "요약 지지선 위",
    });
  });

  it("댓글은 글 id 와 댓글 id 를 둘 다 갖는다", () => {
    expect(
      toSearchResult({
        type: "COMMENT",
        id: 9,
        label: "ETH 흐름",
        excerpt: "동의",
        roomSymbol: "ETH",
        postId: 4,
      }),
    ).toMatchObject({
      kind: "comment",
      key: "COMMENT-9",
      commentId: 9,
      postId: 4,
      postTitle: "ETH 흐름",
    });
  });

  it("방은 한글명을 붙인다", () => {
    expect(
      toSearchResult({ type: "ROOM", id: 2, label: "Ethereum", roomSymbol: "ETH" }),
    ).toMatchObject({
      kind: "room",
      symbol: "ETH",
      name: "이더리움",
    });
  });

  it("사용자는 닉네임을 쓴다", () => {
    expect(toSearchResult({ type: "USER", id: 7, label: "테스터" })).toMatchObject({
      kind: "user",
      key: "USER-7",
      nickname: "테스터",
    });
  });

  it("이동할 곳을 못 만드는 항목과 모르는 종류는 버린다", () => {
    expect(toSearchResult({ type: "POST", id: 1, label: "방 없음" })).toBeNull();
    expect(toSearchResult({ type: "COMMENT", id: 1, roomSymbol: "ETH" })).toBeNull();
    expect(toSearchResult({ type: "NEWS", id: 1, label: "x" })).toBeNull();
    expect(toSearchResult({ type: "POST", label: "id 없음", roomSymbol: "ETH" })).toBeNull();
  });
});

describe("highlightParts", () => {
  it("대소문자를 무시하고 모든 위치를 표시한다", () => {
    expect(highlightParts("ETH 와 eth", "Eth")).toEqual([
      { text: "ETH", match: true },
      { text: " 와 ", match: false },
      { text: "eth", match: true },
    ]);
  });

  it("없으면 통째로 하나다", () => {
    expect(highlightParts("비트코인", "이더")).toEqual([{ text: "비트코인", match: false }]);
  });

  it("소문자로 바꾸면 길이가 달라지는 글자가 있으면 표시하지 않는다", () => {
    expect(highlightParts("İstanbul eth", "eth")).toEqual([{ text: "İstanbul eth", match: false }]);
  });
});

describe("searchProblem", () => {
  it("빈 검색어와 100자 초과를 막는다", () => {
    expect(searchProblem("   ")).not.toBeNull();
    expect(searchProblem("a".repeat(101))).not.toBeNull();
    expect(searchProblem(` ${"a".repeat(100)} `)).toBeNull();
  });
});

describe("searchHref", () => {
  it("방과 쪽을 싣고 1쪽은 적지 않는다", () => {
    expect(searchHref("이더 & 비트")).toBe("/search?q=%EC%9D%B4%EB%8D%94+%26+%EB%B9%84%ED%8A%B8");
    expect(searchHref("eth", { room: "ETH", page: 1 })).toBe("/search?q=eth&room=ETH");
    expect(searchHref("eth", { page: 3 })).toBe("/search?q=eth&page=3");
  });
});
