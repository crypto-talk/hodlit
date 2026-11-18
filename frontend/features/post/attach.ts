import { isGeneralRoom } from "@/lib/room-status";
import type { WriteRoom } from "./types";

/**
 * 글에 붙일 코인 고르기 규칙 (HODL-106, `docs/SOCIAL_API.md` 의 `attachedCoins`).
 *
 * - 방 코인은 서버가 알아서 넣는다. 그래서 고른 목록에는 넣지 않는다(기타 방은 방 코인이 없다)
 * - 고른 코인은 최대 3개, 같은 코인 두 번 안 됨
 * - 보유 인증을 지원하는 코인만. 그 코인의 방이 닫혀 있어도 고를 수 있다
 * - 기타 방(`OTHER`)은 코인이 아니라 고를 수 없다. 기타 방에서는 0개도 된다
 */

export const ATTACH_MAX = 3;

/** 고를 수 있는 코인인지. 닫힌 방이어도 된다. */
export function isAttachable(room: WriteRoom): boolean {
  return room.verifiable && !isGeneralRoom(room.symbol);
}

/** 추가 칸에 보일 코인. 방 코인과 이미 고른 것은 뺀다. 서버가 준 코인 순서 그대로. */
export function attachOptions(rooms: WriteRoom[], roomSymbol: string): WriteRoom[] {
  return rooms.filter((room) => isAttachable(room) && room.symbol !== roomSymbol);
}

/**
 * 보낼 목록. 방 코인과 겹치는 것 · 중복은 뺀다 — 임시저장에서 고른 뒤 방을 그 코인으로
 * 바꾼 경우가 있다. 고른 순서는 지킨다(서버가 그 순서로 기록한다).
 */
export function attachedForRoom(selected: string[], roomSymbol: string): string[] {
  return selected.filter(
    (symbol, index) => symbol !== roomSymbol && selected.indexOf(symbol) === index,
  );
}

/** 발행 전 검사. 문제가 없으면 null. */
export function attachProblem(selected: string[], rooms: WriteRoom[] | undefined): string | null {
  if (selected.length > ATTACH_MAX) return `코인은 ${ATTACH_MAX}개까지 붙일 수 있습니다.`;
  if (!rooms) return null;
  const blocked = selected.filter((symbol) => {
    const room = rooms.find((item) => item.symbol === symbol);
    return !room || !isAttachable(room);
  });
  return blocked.length > 0
    ? `${blocked.join(" · ")} 은(는) 지금 붙일 수 없는 코인입니다. 빼고 발행해 주세요.`
    : null;
}
