import { describe, expect, it } from "vitest";
import {
  bandPreview,
  compareDecimal,
  configProblem,
  decimalOf,
  plainDecimal,
  rangeText,
  sameTiers,
  tierProblems,
} from "./badge-tiers";
import type { BadgeTier } from "./types";

const tier = (name: string, minimumQuantity: string | number): BadgeTier => ({
  name,
  minimumQuantity,
  icon: "fish",
  color: "mint",
  effect: "none",
});

const ETH = [tier("새우", "0"), tier("물고기", "0.1"), tier("돌고래", "1"), tier("고래", "100")];

describe("decimalOf · plainDecimal · compareDecimal", () => {
  it("숫자 모양만 받는다", () => {
    expect(decimalOf("0.1")).toBe("0.1");
    expect(decimalOf(10)).toBe("10");
    expect(decimalOf(" 1 ")).toBe("1");
    expect(decimalOf("1e3")).toBeNull();
    expect(decimalOf("-1")).toBeNull();
    expect(decimalOf("1.")).toBeNull();
    expect(decimalOf("")).toBeNull();
  });

  it("앞뒤 0 을 걷어낸다", () => {
    expect(plainDecimal("01.50")).toBe("1.5");
    expect(plainDecimal("0.0")).toBe("0");
    expect(plainDecimal("100")).toBe("100");
  });

  it("부동소수로 못 담는 자릿수도 견준다", () => {
    expect(compareDecimal("0.100000000000000001", "0.1")).toBeGreaterThan(0);
    expect(compareDecimal("123456789012345678", "123456789012345679")).toBeLessThan(0);
    expect(compareDecimal("1.0", "1")).toBe(0);
    expect(compareDecimal("9", "10")).toBeLessThan(0);
  });
});

describe("tierProblems · configProblem", () => {
  it("기본 설정은 문제 없음", () => {
    expect(tierProblems(ETH)).toEqual([null, null, null, null]);
    expect(configProblem(ETH)).toBeNull();
  });

  it("첫 등급은 0 이어야 한다", () => {
    expect(tierProblems([tier("새우", "0.5")])[0]).toContain("0이어야");
    expect(tierProblems([tier("새우", "0.0")])[0]).toBeNull();
  });

  it("같은 수량 · 거꾸로 된 순서를 잡는다", () => {
    const problems = tierProblems([
      tier("a", "0"),
      tier("b", "1"),
      tier("c", "1"),
      tier("d", "0.5"),
    ]);
    expect(problems[1]).toBeNull();
    expect(problems[2]).toContain("겹칩니다");
    expect(problems[3]).toContain("작습니다");
  });

  it("빈 이름 · 숫자가 아닌 수량을 잡는다", () => {
    expect(tierProblems([tier(" ", "0")])[0]).toContain("이름");
    expect(tierProblems([tier("새우", "0"), tier("물고기", "abc")])[1]).toContain("숫자");
  });

  it("앞 등급이 잘못됐을 때 뒤 등급에 같은 말을 되풀이하지 않는다", () => {
    expect(
      tierProblems([tier("새우", "0"), tier("물고기", "x"), tier("돌고래", "1")])[2],
    ).toBeNull();
  });

  it("등급이 없으면 저장할 수 없다", () => {
    expect(configProblem([])).toContain("하나는");
  });
});

describe("bandPreview · rangeText", () => {
  it("서버가 찍는 모양과 같다", () => {
    expect(bandPreview(ETH, 0, "ETH")).toBe("0~0.1 ETH");
    expect(bandPreview(ETH, 1, "ETH")).toBe("0.1~1 ETH");
    expect(bandPreview(ETH, 3, "ETH")).toBe("100+ ETH");
  });

  it("말로 푼 구간", () => {
    expect(rangeText(ETH, 0)).toBe("0 초과 0.1 미만");
    expect(rangeText(ETH, 1)).toBe("0.1 이상 1 미만");
    expect(rangeText(ETH, 3)).toBe("100 이상 (위쪽 끝 없음)");
  });
});

describe("sameTiers", () => {
  it("1 과 1.0 은 같은 설정", () => {
    expect(sameTiers([tier("a", "0"), tier("b", "1")], [tier("a", 0), tier("b", "1.0")])).toBe(
      true,
    );
  });

  it("이름 · 순서 · 개수가 다르면 달라진 것", () => {
    expect(sameTiers(ETH, [...ETH].reverse())).toBe(false);
    expect(sameTiers(ETH, ETH.slice(0, 3))).toBe(false);
    expect(sameTiers([tier("a", "0")], [tier("b", "0")])).toBe(false);
  });
});
