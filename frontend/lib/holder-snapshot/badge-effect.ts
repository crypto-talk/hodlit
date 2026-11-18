/** 동물 등급 배지가 놓이는 자리. 자리마다 크기와 효과 세기가 다르다. */
export type BadgePosition = "detail" | "list" | "comment";

const EFFECTS = ["none", "soft", "border", "shine", "flow", "aurora"];

/**
 * 자리에 맞는 효과 (HODL-81).
 *
 * - 글 상세: 설정한 효과 그대로
 * - 목록 · 댓글: 움직이지 않는 것만. 같은 배지가 수십 개 반복되는 자리라 움직이면 글이 안 읽힌다.
 *   움직이는 효과(반짝 · 흐르는 테두리 · 오로라)는 테두리 한 줄로 낮춘다
 *
 * 모르는 값이 오면 효과 없이 그린다 — 이 값이 그대로 class 이름이 되기 때문이다.
 */
export function effectAt(position: BadgePosition, effect: string | null | undefined): string {
  const known = effect && EFFECTS.includes(effect) ? effect : "none";
  if (position === "detail") return known;
  if (known === "none" || known === "soft") return known;
  return "border";
}
