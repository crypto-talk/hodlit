import type { DrawEvent, DrawPhase, DrawResult } from "./types";

/**
 * 이벤트와 내 결과로 화면 상태를 정한다.
 *
 * 결과가 있으면 무엇보다 먼저 `done` 이다 — 이벤트가 끝났거나 멈췄어도 이미 뽑은 사람은 자기
 * 결과를 봐야 한다. 참여할 수 있는지는 서버의 `canParticipate` 를 따르고, 못 하는 이유만
 * 시각으로 가른다(기간 전 · 종료 · 그 밖에는 중지).
 */
export function drawPhase(event: DrawEvent, result: DrawResult | null, now: number): DrawPhase {
  if (result) return "done";
  if (event.canParticipate) return "open";

  const starts = Date.parse(event.startsAt);
  const ends = Date.parse(event.endsAt);
  if (Number.isFinite(starts) && now < starts) return "before";
  if (Number.isFinite(ends) && now >= ends) return "ended";
  return "paused";
}
