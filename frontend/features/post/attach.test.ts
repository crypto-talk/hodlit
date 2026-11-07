import { describe, expect, it } from "vitest";
import { attachOptions, attachProblem, attachedForRoom } from "./attach";
import { referenceLabel, referenceOf, toHoldingsReference } from "./holdings";
import type { WriteRoom } from "./types";

const room = (symbol: string, verifiable = true, open = true): WriteRoom => ({
  symbol,
  verifiable,
  open,
  name: symbol,
});
const ROOMS = [
  room("BTC"),
  room("ETH"),
  room("SOL", true, false),
  room("DOGE", false),
  room("OTHER", false),
];

describe("attachOptions", () => {
  it("인증 지원 코인만, 방 코인과 기타 방은 빼고, 닫힌 방은 남긴다", () => {
    expect(attachOptions(ROOMS, "ETH").map((item) => item.symbol)).toEqual(["BTC", "SOL"]);
  });

  it("기타 방에서는 방 코인이 없어 지원 코인 전부", () => {
    expect(attachOptions(ROOMS, "OTHER").map((item) => item.symbol)).toEqual(["BTC", "ETH", "SOL"]);
  });
});

describe("attachedForRoom", () => {
  it("방 코인 · 중복을 빼고 순서를 지킨다", () => {
    expect(attachedForRoom(["SOL", "ETH", "BTC", "SOL"], "ETH")).toEqual(["SOL", "BTC"]);
  });
});

describe("attachProblem", () => {
  it("3개까지", () => {
    expect(attachProblem(["BTC", "ETH", "SOL"], ROOMS)).toBeNull();
    expect(attachProblem(["BTC", "ETH", "SOL", "XRP"], ROOMS)).toMatch(/3개까지/);
  });

  it("지금 붙일 수 없는 코인을 알려 준다", () => {
    expect(attachProblem(["DOGE", "BTC", "XRP"], ROOMS)).toMatch(/DOGE · XRP/);
  });

  it("방 목록이 아직 없으면 개수만 본다", () => {
    expect(attachProblem(["DOGE"], undefined)).toBeNull();
  });
});

describe("holdings reference", () => {
  const reference = toHoldingsReference({
    walletCount: 1,
    exchangeCount: 0,
    assets: [
      { symbol: "ETH", quantity: 1.2, quantityBand: "1~10 ETH", syncStatus: "READY" },
      { symbol: "SOL", quantity: 3, quantityBand: "1~10 SOL", syncStatus: "PARTIAL" },
    ],
    unresolvedAssets: [{ symbol: "SOL" }, { symbol: "BTC" }],
  });

  it("양수가 확인되면 일부 실패여도 보유", () => {
    expect(referenceOf(reference, "ETH")).toEqual({
      kind: "holder",
      band: "1~10 ETH",
      partial: false,
    });
    expect(referenceLabel(referenceOf(reference, "SOL"))).toBe("지금 1~10 SOL · 일부만 확인");
  });

  it("확인 실패는 잔액 0 으로 말하지 않는다", () => {
    expect(referenceOf(reference, "BTC")).toEqual({ kind: "unknown" });
    expect(referenceLabel(referenceOf(reference, "BTC"))).toBe("지금 확인 실패");
  });

  it("목록에 없고 실패도 아니면 잔액 0", () => {
    expect(referenceOf(reference, "XRP")).toEqual({ kind: "empty" });
  });

  it("연결이 없으면 전부 연결 없음", () => {
    const none = toHoldingsReference({ walletCount: 0, exchangeCount: 0, assets: [] });
    expect(referenceOf(none, "ETH")).toEqual({ kind: "not-connected" });
  });

  it("모양이 이상한 응답도 깨지지 않는다", () => {
    expect(toHoldingsReference({ assets: "x", unresolvedAssets: null })).toEqual({
      connected: false,
      held: {},
      unresolved: [],
    });
  });
});
