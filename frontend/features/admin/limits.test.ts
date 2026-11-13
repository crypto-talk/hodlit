import { describe, expect, it } from "vitest";
import { bannerImageProblem, bannerProblems, newsProblems, pollProblems } from "./limits";

const news = {
  title: "제목",
  summary: "요약",
  sourceName: "출처",
  sourceUrl: "https://example.com/a",
};

describe("newsProblems", () => {
  it("네 칸이 맞으면 문제 없음", () => {
    expect(newsProblems(news)).toEqual({});
  });

  it("빈 칸과 긴 칸을 칸마다 알려 준다", () => {
    const problems = newsProblems({ ...news, title: " ", summary: "가".repeat(1001) });
    expect(problems.title).toContain("적어 주세요");
    expect(problems.summary).toContain("1000자");
    expect(problems.sourceName).toBeUndefined();
  });

  it("원문 링크는 http(s) 만", () => {
    expect(newsProblems({ ...news, sourceUrl: "javascript:alert(1)" }).sourceUrl).toContain("http");
    expect(newsProblems({ ...news, sourceUrl: "/news/1" }).sourceUrl).toContain("http");
    expect(newsProblems({ ...news, sourceUrl: "https://u:p@example.com" }).sourceUrl).toBeDefined();
  });
});

describe("pollProblems", () => {
  it("질문과 선택지 둘이면 문제 없음", () => {
    expect(pollProblems({ question: "오를까?", choices: ["상승", "하락"] })).toEqual({});
  });

  it("선택지 수 · 빈 칸 · 길이를 잡는다", () => {
    expect(pollProblems({ question: "q", choices: ["a"] }).choices).toContain("2개 이상");
    expect(pollProblems({ question: "q", choices: ["a", " "] }).choices).toContain("2번");
    expect(pollProblems({ question: "q", choices: ["a", "b".repeat(101)] }).choices).toContain(
      "100자",
    );
    expect(
      pollProblems({ question: "q", choices: Array.from({ length: 11 }, (_, i) => `c${i}`) })
        .choices,
    ).toContain("10개까지");
  });

  it("공백 · 대소문자만 다른 선택지는 같은 것으로 본다", () => {
    expect(pollProblems({ question: "q", choices: ["Up", " up "] }).choices).toContain("2번");
  });

  it("빈 질문을 잡는다", () => {
    expect(pollProblems({ question: "", choices: ["a", "b"] }).question).toBeDefined();
  });
});

describe("bannerProblems · bannerImageProblem", () => {
  const banner = {
    title: "ETH 오픈",
    imageUrl: "/api/v1/media/a.png",
    altText: "ETH 방 오픈 안내",
    linkUrl: "",
    visible: true,
  };

  it("링크는 비워도 된다", () => {
    expect(bannerProblems(banner)).toEqual({});
  });

  it("사이트 안 경로와 http(s) 주소만 받는다", () => {
    expect(bannerProblems({ ...banner, linkUrl: "/subhodl/ETH" })).toEqual({});
    expect(bannerProblems({ ...banner, linkUrl: "https://example.com" })).toEqual({});
    expect(bannerProblems({ ...banner, linkUrl: "//evil.example" }).linkUrl).toBeDefined();
    expect(bannerProblems({ ...banner, linkUrl: "javascript:alert(1)" }).linkUrl).toBeDefined();
  });

  it("이미지 · 제목 · 대체 텍스트는 꼭 있어야 한다", () => {
    const problems = bannerProblems({ ...banner, imageUrl: "", title: "", altText: " " });
    expect(Object.keys(problems).sort()).toEqual(["altText", "imageUrl", "title"]);
  });

  it("이미지 형식과 용량", () => {
    expect(bannerImageProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(bannerImageProblem({ type: "image/svg+xml", size: 1000 })).toContain("JPG");
    expect(bannerImageProblem({ type: "image/png", size: 26 * 1024 * 1024 })).toContain("25MB");
  });
});
