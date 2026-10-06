import { describe, expect, it } from "vitest";
import { markdownToPlainText } from "./plain-text";

describe("markdownToPlainText", () => {
  it("평문은 그대로 둔다 (예전 글)", () => {
    expect(markdownToPlainText("ETH 지금 바닥인 듯")).toBe("ETH 지금 바닥인 듯");
  });

  it("제목·인용·목록 기호를 걷어낸다", () => {
    expect(markdownToPlainText("## 전망\n\n> 인용문\n\n- 하나\n2. 둘")).toBe("전망 인용문 하나 둘");
  });

  it("굵게·기울임·취소선·코드는 글자만 남긴다", () => {
    expect(markdownToPlainText("**ETH** *장기* ~~단타~~ `0x12`")).toBe("ETH 장기 단타 0x12");
  });

  it("링크는 글자만, 이미지는 뺀다", () => {
    expect(markdownToPlainText("[백서](https://x.io) 참고 ![차트](/a.png)")).toBe("백서 참고");
  });

  it("코드 블록 울타리와 구분선은 뺀다", () => {
    expect(markdownToPlainText("앞\n\n```\ncode\n```\n\n---\n\n뒤")).toBe("앞 code 뒤");
  });

  it("이스케이프된 기호는 기호로 돌린다", () => {
    expect(markdownToPlainText("1\\. 수익률 \\*주의\\*")).toBe("1. 수익률 *주의*");
  });

  it("snake_case 의 밑줄은 기울임으로 보지 않는다", () => {
    expect(markdownToPlainText("wallet_count 값")).toBe("wallet_count 값");
  });
});
