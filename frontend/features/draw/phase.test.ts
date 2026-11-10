import { describe, expect, it } from "vitest";
import { drawPhase } from "./phase";
import type { DrawEvent, DrawResult } from "./types";

const event = (patch: Partial<DrawEvent> = {}): DrawEvent => ({
  id: 1,
  title: "오픈 기념 뽑기",
  description: "",
  startsAt: "2026-11-10T00:00:00Z",
  endsAt: "2026-11-20T00:00:00Z",
  status: "ACTIVE",
  canParticipate: true,
  prizes: [],
  ...patch,
});
const result: DrawResult = {
  id: 9,
  prizeName: "스티커",
  image: null,
  capturedAt: "2026-11-11T00:00:00Z",
};
const at = (iso: string) => Date.parse(iso);

describe("drawPhase", () => {
  it("결과가 있으면 이벤트가 끝났어도 done", () => {
    expect(drawPhase(event({ canParticipate: false }), result, at("2026-12-01T00:00:00Z"))).toBe(
      "done",
    );
  });

  it("서버가 참여할 수 있다고 하면 open", () => {
    expect(drawPhase(event(), null, at("2026-11-11T00:00:00Z"))).toBe("open");
  });

  it("참여할 수 없는 이유를 시각으로 가른다", () => {
    const closed = event({ canParticipate: false });
    expect(drawPhase(closed, null, at("2026-11-09T00:00:00Z"))).toBe("before");
    expect(drawPhase(closed, null, at("2026-11-20T00:00:00Z"))).toBe("ended");
    expect(drawPhase(closed, null, at("2026-11-11T00:00:00Z"))).toBe("paused");
  });

  it("시각을 못 읽으면 중지로 본다", () => {
    expect(drawPhase(event({ canParticipate: false, startsAt: "", endsAt: "" }), null, 0)).toBe(
      "paused",
    );
  });
});
