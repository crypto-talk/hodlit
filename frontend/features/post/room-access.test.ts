import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/lib/http";
import { loadWriteRooms } from "./api";

vi.mock("@/lib/http", () => ({ http: vi.fn() }));

describe("방 운영 상태에 따른 글쓰기 선택", () => {
  beforeEach(() => vi.resetAllMocks());

  it("ETH도 닫히면 제외하고 다른 코인도 열리면 선택할 수 있다", async () => {
    vi.mocked(http).mockResolvedValue([
      {
        symbol: "ETH",
        name: "Ethereum",
        operationStatus: "CLOSE",
        verificationAvailability: "SUPPORTED",
      },
      {
        symbol: "BTC",
        name: "Bitcoin",
        operationStatus: "OPEN",
        verificationAvailability: "SUPPORTED",
      },
    ]);
    expect((await loadWriteRooms()).filter((room) => room.open).map((room) => room.symbol)).toEqual(
      ["BTC"],
    );
  });

  it("운영 상태가 누락된 구형 응답은 기존 호환 정책을 따른다", async () => {
    vi.mocked(http).mockResolvedValue([{ symbol: "ETH", name: "Ethereum" }]);
    expect((await loadWriteRooms())[0].open).toBe(true);
  });
});
