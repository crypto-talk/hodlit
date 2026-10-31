/**
 * 관리자 화면 타입.
 *
 * 백엔드 `RoomAdminService.RoomResponse` (docs/ROOM_OPERATION_API.md). 아직 생성 타입
 * (`lib/api-schema.ts`)에 없어서 손으로 적는다. 스키마를 다시 생성하면 그쪽으로 옮긴다.
 */

/** 방 운영 상태. 닫힌 방은 글 · 댓글 · 투표 · 뉴스가 `403 ROOM_CLOSED` 로 막힌다. */
export type RoomOperationStatus = "OPEN" | "CLOSE";

export type AdminRoom = {
  id: number;
  symbol: string;
  /** 화면에 보일 이름. 한글명이 있으면 한글명이다. */
  name: string;
  /**
   * 코인 목록에 들어 있는지. 비활성 코인은 방을 열어도 사용자 화면 어디에도 나오지 않는다.
   * 관리자 API 로는 바꿀 수 없고 DB 에서만 바뀐다.
   */
  active: boolean;
  operationStatus: RoomOperationStatus;
};

export type AdminRoomPage = {
  items: AdminRoom[];
  /** 1부터. */
  page: number;
  totalPages: number;
  totalElements: number;
};
