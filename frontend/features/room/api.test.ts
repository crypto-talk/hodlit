import { describe, expect, it } from "vitest";
import { toRoomStats } from "./api";

describe("toRoomStats", () => {
  it("참여자 수와 인증률을 읽는다", () => {
    expect(
      toRoomStats(
        {
          window: "24h",
          rooms: [{ symbol: "ETH", participantCount: 12, verifiedParticipantRate: 25 }],
        },
        "eth",
        "24h",
      ),
    ).toEqual({ window: "24h", participants: 12, verifiedRate: 25 });
  });

  it("참여자가 없으면 인증률은 0 이 아니라 없음이다", () => {
    expect(
      toRoomStats(
        { rooms: [{ symbol: "ETH", participantCount: 0, verifiedParticipantRate: 0 }] },
        "ETH",
        "all",
      ),
    ).toEqual({ window: "all", participants: 0, verifiedRate: null });
    expect(toRoomStats({ rooms: [] }, "ETH", "24h").participants).toBe(0);
  });

  it("범위를 벗어난 인증률은 0~100 으로 자른다", () => {
    expect(
      toRoomStats(
        { rooms: [{ symbol: "ETH", participantCount: 3, verifiedParticipantRate: 140 }] },
        "ETH",
        "24h",
      ).verifiedRate,
    ).toBe(100);
  });
});
