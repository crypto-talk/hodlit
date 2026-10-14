import { describe, expect, it } from "vitest";
import type { HolderSnapshot } from "./types";
import {
  UNKNOWN_HOLDING_LABEL,
  amountLabel,
  holdingLabel,
  holdingPeriodLabel,
  isVerifiable,
  isHolderTier,
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
    syncStatus: "READY",
    holderStatus: "HOLDER",
    ...overrides,
  };
}

describe("verificationLabel", () => {
  it("서버 등급을 문구로 옮긴다", () => {
    expect(verificationLabel(snapshot({ verificationLevel: "WALLET" }))).toBe("지갑연결");
    expect(verificationLabel(snapshot({ verificationLevel: "UNVERIFIED" }))).toBe("미인증");
  });

  it("거래소 연동 등급", () => {
    expect(verificationLabel(snapshot({ verificationLevel: "EXCHANGE" }))).toBe("거래소연동");
  });

  it("모르는 등급은 가장 약한 쪽으로 떨어뜨린다", () => {
    expect(verificationLabel(snapshot({ verificationLevel: "SOMETHING_NEW" }))).toBe("미인증");
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
  it("HOLDER 는 등급에 따라 지갑연결 · 거래소연동", () => {
    expect(tierOf("WALLET", true, "HOLDER")).toBe("wallet");
    expect(tierOf("EXCHANGE", true, "HOLDER")).toBe("exchange");
    expect(tierLabel(tierOf("EXCHANGE", true, "HOLDER"))).toBe("거래소연동");
  });

  it("미보유는 EMPTY 일 때만", () => {
    expect(tierOf("UNVERIFIED", false, "EMPTY")).toBe("empty");
  });

  it("확인 실패 · 연결 없음은 미보유가 아니라 미인증", () => {
    expect(tierOf("UNVERIFIED", false, "UNKNOWN")).toBe("none");
    expect(tierOf("UNVERIFIED", false, "NOT_CONNECTED")).toBe("none");
  });

  it("오래된 기록 복사본(UNKNOWN)은 verifiedHolder 가 true 여도 보유자가 아니다", () => {
    expect(tierOf("WALLET", true, "UNKNOWN")).toBe("none");
  });

  it("holderStatus 가 없으면 verifiedHolder 로 가른다", () => {
    expect(tierOf("WALLET", true)).toBe("wallet");
    expect(tierOf("UNVERIFIED", false)).toBe("none");
    expect(tierOf(undefined, undefined, null)).toBe("none");
  });

  it("모르는 holderStatus 는 미인증", () => {
    expect(tierOf("WALLET", true, "SOMETHING_NEW")).toBe("none");
  });

  it("미보유 문구는 코인을 붙인다", () => {
    expect(tierLabel("empty", "ETH")).toBe("ETH 미보유");
    expect(tierLabel("empty")).toBe("미보유");
    expect(tierLabel("none", "ETH")).toBe("미인증");
  });

  it("보유가 확인된 등급만 보유자로 센다", () => {
    expect(isHolderTier("wallet")).toBe(true);
    expect(isHolderTier("exchange")).toBe(true);
    expect(isHolderTier("empty")).toBe(false);
    expect(isHolderTier("none")).toBe(false);
  });

  it("verificationLabel 과 같은 문구를 쓴다", () => {
    expect(tierLabel("wallet")).toBe(verificationLabel(snapshot({ verificationLevel: "WALLET" })));
    expect(tierLabel("none")).toBe(
      verificationLabel(snapshot({ verificationLevel: "UNVERIFIED" })),
    );
  });
});

describe("isVerifiable", () => {
  it("SUPPORTED 만 지원으로 본다", () => {
    expect(isVerifiable("SUPPORTED")).toBe(true);
    expect(isVerifiable("NOT_SUPPORTED")).toBe(false);
  });

  it("모르는 값이나 빈 값은 미지원으로 떨어뜨린다", () => {
    expect(isVerifiable("SOMETHING_NEW")).toBe(false);
    expect(isVerifiable(undefined)).toBe(false);
    expect(isVerifiable(null)).toBe(false);
  });
});
