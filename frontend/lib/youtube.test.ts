import { describe, expect, it } from "vitest";
import { isYoutubeVideoId, youtubeIdsInContent, youtubeVideoId, type DocNode } from "./youtube";

const ID = "dQw4w9WgXcQ";

const paragraph = (...content: DocNode[]): DocNode => ({ type: "paragraph", content });
const text = (value: string, marks: DocNode["marks"] = []): DocNode => ({
  type: "text",
  text: value,
  marks,
});
const link = (value: string, href: string) => text(value, [{ type: "link", attrs: { href } }]);
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

describe("youtubeVideoId", () => {
  it("일반 영상 · 단축 · Shorts 주소에서 id 를 꺼낸다", () => {
    expect(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://youtu.be/${ID}?t=30`)).toBe(ID);
    expect(youtubeVideoId(`youtube.com/shorts/${ID}`)).toBe(ID);
  });

  it("유튜브 영상 주소가 아니면 null", () => {
    expect(youtubeVideoId("https://www.youtube.com/@channel")).toBeNull();
    expect(youtubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeVideoId(`https://youtu.be/${ID}x`)).toBeNull();
  });
});

describe("isYoutubeVideoId", () => {
  it("11자 영상 id 모양만 받는다", () => {
    expect(isYoutubeVideoId(ID)).toBe(true);
    expect(isYoutubeVideoId("../../evil")).toBe(false);
    expect(isYoutubeVideoId(`${ID}?a=1`)).toBe(false);
    expect(isYoutubeVideoId(null)).toBe(false);
  });
});

describe("youtubeIdsInContent", () => {
  it("링크 주소와 글자 속 주소를 처음 나온 순서대로, 겹치지 않게 모은다", () => {
    const content = doc(
      paragraph(
        link("영상", `https://www.youtube.com/watch?v=${ID}&t=3`),
        text(" 그리고 youtu.be/AAAAAAAAAAA). 다시 "),
        link(`https://youtu.be/${ID}`, `https://youtu.be/${ID}`),
      ),
      paragraph(link("쇼츠", "https://youtube.com/shorts/BBBBBBBBBBB")),
    );
    expect(youtubeIdsInContent(content)).toEqual([ID, "AAAAAAAAAAA", "BBBBBBBBBBB"]);
  });

  it("유튜브 영상이 아닌 링크는 넣지 않는다", () => {
    const content = doc(
      paragraph(
        link("채널", "https://www.youtube.com/@hodlit"),
        link("다른 곳", "https://example.com/youtu.be/CCCCCCCCCCC"),
        text(" notyoutu.be/DDDDDDDDDDD"),
      ),
    );
    expect(youtubeIdsInContent(content)).toEqual([]);
  });

  it("코드 안의 주소는 넣지 않는다", () => {
    const content = doc(paragraph(text(`https://youtu.be/${ID}`, [{ type: "code" }])), {
      type: "codeBlock",
      content: [text("https://youtu.be/AAAAAAAAAAA")],
    });
    expect(youtubeIdsInContent(content)).toEqual([]);
  });

  it("빈 문서", () => {
    expect(youtubeIdsInContent(null)).toEqual([]);
    expect(youtubeIdsInContent(doc())).toEqual([]);
  });
});
