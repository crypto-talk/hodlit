import { describe, expect, it } from "vitest";
import { bodyYoutubeIds } from "./body-markdown";

describe("bodyYoutubeIds", () => {
  it("에디터가 저장한 Markdown 의 유튜브 링크를 찾는다", () => {
    const markdown = [
      "## 오늘 본 영상",
      "",
      "[https://youtu.be/dQw4w9WgXcQ](https://youtu.be/dQw4w9WgXcQ) 와 [쇼츠](https://youtube.com/shorts/BBBBBBBBBBB)",
      "",
      "- 평문 주소 https://www.youtube.com/watch?v=AAAAAAAAAAA&t=1",
      "",
      "`https://youtu.be/CCCCCCCCCCC`",
      "",
      "[다른 링크](https://example.com)",
    ].join("\n");
    expect(bodyYoutubeIds(markdown)).toEqual(["dQw4w9WgXcQ", "BBBBBBBBBBB", "AAAAAAAAAAA"]);
  });

  it("평문으로 쓴 예전 글 · 빈 본문", () => {
    expect(bodyYoutubeIds("영상은 youtu.be/dQw4w9WgXcQ 입니다")).toEqual(["dQw4w9WgXcQ"]);
    expect(bodyYoutubeIds("")).toEqual([]);
  });
});
