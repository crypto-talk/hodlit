import { describe, expect, it } from "vitest";
import {
  formatChangeRate,
  formatCoinKrw,
  formatCompact,
  formatKrw,
  formatQuantity,
} from "./number";

describe("formatKrw", () => {
  it("천 단위를 끊고 소수점을 버린다", () => {
    expect(formatKrw(53_000_000)).toBe("₩53,000,000");
    expect(formatKrw(0)).toBe("₩0");
  });
});

describe("formatCoinKrw", () => {
  it("1,000원 이상은 정수, 미만은 소수 둘째 자리까지", () => {
    expect(formatCoinKrw(108_489_011.4)).toBe("₩108,489,011");
    expect(formatCoinKrw(1000)).toBe("₩1,000");
    expect(formatCoinKrw(122.49)).toBe("₩122.49");
    expect(formatCoinKrw(300)).toBe("₩300");
    expect(formatCoinKrw(0.123)).toBe("₩0.12");
  });
});

describe("formatQuantity", () => {
  it("기본 소수 4자리까지만 보여준다", () => {
    expect(formatQuantity(1.23456789)).toBe("1.2346");
    expect(formatQuantity(1200)).toBe("1,200");
  });
});

describe("formatCompact", () => {
  it("만·억 단위로 줄인다", () => {
    expect(formatCompact(9_999)).toBe("9,999");
    expect(formatCompact(12_400)).toBe("1.2만");
    expect(formatCompact(100_000_000)).toBe("1억");
  });

  it("경계값에서 단위가 바뀐다", () => {
    expect(formatCompact(10_000)).toBe("1만");
    expect(formatCompact(1_234_000_000)).toBe("12.3억");
  });
});

describe("formatChangeRate", () => {
  it("부호를 항상 붙이고 소수 1자리로 맞춘다", () => {
    expect(formatChangeRate(2.44)).toBe("+2.4%");
    expect(formatChangeRate(-2.46)).toBe("-2.5%");
    expect(formatChangeRate(0)).toBe("0.0%");
  });

  it("값이 없으면 대시", () => {
    expect(formatChangeRate(null)).toBe("-");
    expect(formatChangeRate(undefined)).toBe("-");
  });
});
