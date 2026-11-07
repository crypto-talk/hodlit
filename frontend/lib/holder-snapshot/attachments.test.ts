import { describe, expect, it } from "vitest";
import { extraAttachedSymbols, toAttachedHolders } from "./attachments";

describe("toAttachedHolders", () => {
  it("필드가 없으면 null — 옛 응답은 단일 기록으로 그린다", () => {
    expect(toAttachedHolders(undefined)).toBeNull();
  });

  it("빈 배열은 빈 배열 — 단일 기록으로 채우지 않는다", () => {
    expect(toAttachedHolders([])).toEqual([]);
  });

  it("상태를 구분하고 서버 구간을 그대로 쓴다", () => {
    const holders = toAttachedHolders([
      {
        coinSymbol: "ETH",
        verificationAvailability: "SUPPORTED",
        holderStatus: "HOLDER",
        verifiedHolder: true,
        verificationLevel: "WALLET",
        quantityBand: "1~10 ETH",
        syncStatus: "PARTIAL",
      },
      { coinSymbol: "SOL", verificationAvailability: "SUPPORTED", holderStatus: "EMPTY" },
      { coinSymbol: "BTC", verificationAvailability: "SUPPORTED", holderStatus: "UNKNOWN" },
      { coinSymbol: "XRP", verificationAvailability: "SUPPORTED", holderStatus: "NOT_CONNECTED" },
      { verificationAvailability: "SUPPORTED" },
    ]);
    expect(holders?.map((item) => [item.symbol, item.tier, item.holderStatus])).toEqual([
      ["ETH", "wallet", "HOLDER"],
      ["SOL", "empty", "EMPTY"],
      ["BTC", "none", "UNKNOWN"],
      ["XRP", "none", "NOT_CONNECTED"],
    ]);
    expect(holders?.[0]).toMatchObject({ partial: true, amount: "1~10 ETH", verifiable: true });
  });

  it("방 코인을 뺀 고른 코인만", () => {
    const holders = toAttachedHolders([{ coinSymbol: "ETH" }, { coinSymbol: "SOL" }]);
    expect(extraAttachedSymbols(holders, "ETH")).toEqual(["SOL"]);
    expect(extraAttachedSymbols(null, "ETH")).toEqual([]);
  });
});
