import { ApiError } from "@/lib/http";

/**
 * 방 운영 상태 (HODL-77, `docs/ROOM_OPERATION_API.md`).
 *
 * 관리자가 방을 닫으면 그 방의 글 · 댓글 · 투표 · 뉴스 요청이 `403` + `code: "ROOM_CLOSED"` 로
 * 막힌다. 코인 목록(`/coins`)과 방 머리(`/communities/{symbol}`)는 닫힌 방도 주고,
 * 코인마다 `operationStatus` 가 실린다.
 *
 * 방 목록 · 글 · 글쓰기가 모두 같은 판단을 해서 lib 에 둔다(features 끼리 참조 불가).
 */

/** 코인 응답의 운영 상태. 생성 타입(`lib/api-schema.ts`)에 아직 없어서 손으로 적는다. */
export type WithOperationStatus = { operationStatus?: string };

/**
 * 열린 방인지. 값이 없으면 열린 것으로 본다 — 백엔드가 필드를 빼먹었다고 방이 전부
 * 사라지면 안 된다. 닫힌 방에 들어가면 어차피 서버가 403 으로 막는다.
 */
export function isOpenRoom(coin: WithOperationStatus): boolean {
  return coin.operationStatus !== "CLOSE";
}

/**
 * 닫힌 방이라서 거절된 요청인지. 에러 code 로 나누는 건 아직 합의 전이지만(C-5),
 * 이 code 는 백엔드 문서가 분기하라고 정해 둔 것이라 쓴다. 다른 403(권한 없음)과 구별해야 한다.
 */
export function isRoomClosedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.code === "ROOM_CLOSED";
}
