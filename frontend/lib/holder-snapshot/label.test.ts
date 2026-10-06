import { describe, expect, it } from "vitest";
import type { HolderSnapshot } from "./types";
import {
  UNKNOWN_HOLDING_LABEL,
  amountLabel,
  holdingLabel,
  holdingPeriodLabel,
  tierLabel,
  tierOf,
  verificationLabel,
} from "./label";

function snapshot(overrides: Partial<HolderSnapshot> = {}): HolderSnapshot {
  return {
    verificationAvailability: "SUPPORTED",
    verificationLevel: "WALLET",
    verifiedHolder: true,
    quantityBand: "10~100 ETH",
    holdingMonths: null,
    walletCount: 1,
    capturedAt: "2026-09-19T00:00:00Z",
    blockNumber: null,
    syncStatus: "SYNCED",
    ...overrides,
  };
}

describe("verificationLabel", () => {
  it("서버 등급을 문구로 옮긴다", () => {
    expect(verificationLabel(snapshot({ verificationLevel: "WALLET" }))).toBe("지갑연결");
    expect(verificationLabel(snapshot({ verificationLevel: "UNVERIFIED" }))).toBe("미인증");
  });

  it("모르는 등급은 가장 약한 쪽으로 떨어뜨린다", () => {
    // 백엔드가 거래소 연동 등급을 추가하면 여기서 먼저 드러난다.
    expect(verificationLabel(snapshot({ verificationLevel: "EXCHANGE" }))).toBe("미인증");
    expect(verificationLabel(snapshot({ verificationLevel: "" }))).toBe("미인증");
  });
});

describe("amountLabel", () => {
  it("서버가 준 구간을 그대로 쓴다", () => {
    expect(amountLabel(snapshot({ quantityBand: "0.1~1 BTC" }))).toBe("0.1~1 BTC");
  });

  it("미인증이면 null", () => {
    expect(amountLabel(snapshot({ quantityBand: null }))).toBeNull();
  });
});

describe("holdingPeriodLabel", () => {
  it("값이 없으면 고정 문구를 쓴다", () => {
    expect(holdingPeriodLabel(null)).toBe(UNKNOWN_HOLDING_LABEL);
    expect(holdingPeriodLabel(undefined)).toBe(UNKNOWN_HOLDING_LABEL);
  });

  it("1개월 미만은 한 덩어리로 묶는다", () => {
    expect(holdingPeriodLabel(0)).toBe("1개월 미만 보유");
  });

  it("연·월 경계", () => {
    expect(holdingPeriodLabel(1)).toBe("1개월 보유");
    expect(holdingPeriodLabel(11)).toBe("11개월 보유");
    expect(holdingPeriodLabel(12)).toBe("1년 보유");
    expect(holdingPeriodLabel(13)).toBe("1년 1개월 보유");
    expect(holdingPeriodLabel(24)).toBe("2년 보유");
    expect(holdingPeriodLabel(27)).toBe("2년 3개월 보유");
  });

  it("월 아래 단위는 표기에 남지 않는다", () => {
    expect(holdingPeriodLabel(8.7)).toBe("8개월 보유");
  });

  it("음수와 NaN 은 미확인으로 떨어진다", () => {
    expect(holdingPeriodLabel(-1)).toBe(UNKNOWN_HOLDING_LABEL);
    expect(holdingPeriodLabel(Number.NaN)).toBe(UNKNOWN_HOLDING_LABEL);
  });
});

describe("holdingLabel", () => {
  it("인덱서 전까지는 항상 미확인이다", () => {
    expect(holdingLabel(snapshot({ holdingMonths: null }))).toBe(UNKNOWN_HOLDING_LABEL);
  });

  it("값이 오면 그대로 쓴다. 여기서 반올림하지 않는다", () => {
    expect(holdingLabel(snapshot({ holdingMonths: 8 }))).toBe("8개월 보유");
  });
});

describe("tierOf · tierLabel", () => {
  it("WALLET 은 지갑연결, 그 밖은 미인증", () => {
    expect(tierLabel(tierOf("WALLET", true))).toBe("지갑연결");
    expect(tierLabel(tierOf("UNVERIFIED", false))).toBe("미인증");
    expect(tierLabel(tierOf(undefined, undefined))).toBe("미인증");
  });

  it("verificationLabel 과 같은 문구를 쓴다", () => {
    expect(tierLabel("wallet")).toBe(verificationLabel(snapshot({ verificationLevel: "WALLET" })));
    expect(tierLabel("none")).toBe(
      verificationLabel(snapshot({ verificationLevel: "UNVERIFIED" })),
    );
  });
});
