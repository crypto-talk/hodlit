import type { RoomOperationStatus } from "@/lib/room-status";

/**
 * 관리자 화면 타입.
 *
 * 응답 원본은 생성 타입(`RoomResponse` · `PageResponseRoomResponse`)이고, 모든 필드가 선택(`?`)이라
 * 화면이 쓰는 모양으로 `api.ts` 에서 좁힌다.
 */

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
