import { coinNameKo } from "@/lib/coin-name-ko";
import { http } from "@/lib/http";
import type { AdminRoomFilter } from "@/lib/routes";
import type { AdminRoom, AdminRoomPage, RoomOperationStatus } from "./types";

/**
 * 관리자 API (HODL-77 · HODL-78).
 *
 * 관리자인지는 백엔드가 `members.role` 로 요청마다 판단한다. 프론트가 받는 응답에는 아직
 * role 이 없어서(HODL-88), 관리자 화면에 들어올 수 있는지도 이 API 의 응답 코드로 정한다.
 * 로그인 전 401, 관리자가 아니면 403 이다.
 */

const ADMIN_ROOMS = "/api/v1/admin/communities";

/** 한 쪽에 보이는 방 수. 코인이 20개라 지금은 한 쪽에 다 들어간다. */
export const ADMIN_ROOM_PAGE_SIZE = 20;

type RoomResponse = {
  id?: number;
  symbol?: string;
  name?: string;
  active?: boolean;
  operationStatus?: string;
};

type RoomPageResponse = {
  items?: RoomResponse[];
  page?: number;
  totalPages?: number;
  totalElements?: number;
};

const STATUS_PARAM: Record<AdminRoomFilter, RoomOperationStatus> = {
  open: "OPEN",
  closed: "CLOSE",
};

/** 방 목록. `page` 는 1부터 받는다(백엔드는 0부터). */
export async function loadAdminRooms(options: {
  q?: string;
  status?: AdminRoomFilter | null;
  page?: number;
  size?: number;
}): Promise<AdminRoomPage> {
  const page = Math.max(1, options.page ?? 1);
  const query = new URLSearchParams({
    page: String(page - 1),
    size: String(options.size ?? ADMIN_ROOM_PAGE_SIZE),
  });
  const q = options.q?.trim();
  if (q) query.set("q", q.slice(0, 100));
  if (options.status) query.set("operationStatus", STATUS_PARAM[options.status]);

  const result = await http<RoomPageResponse>(`${ADMIN_ROOMS}?${query.toString()}`);
  return {
    items: (result.items ?? []).flatMap(toRoom),
    page: (result.page ?? page - 1) + 1,
    totalPages: result.totalPages ?? 0,
    totalElements: result.totalElements ?? 0,
  };
}

/**
 * 관리자 화면에 들어올 수 있는지 확인한다. 가장 가벼운 방 목록 요청을 보내고, 실패하면
 * `ApiError` 를 그대로 던진다 — 화면이 `status` 로 401 · 403 을 나눈다.
 */
export async function checkAdminAccess(): Promise<true> {
  await loadAdminRooms({ size: 1 });
  return true;
}

/** 방 열기 · 닫기. 같은 상태를 다시 보내도 괜찮다(백엔드가 멱등). */
export async function setRoomStatus(
  symbol: string,
  operationStatus: RoomOperationStatus,
): Promise<AdminRoom | null> {
  const result = await http<RoomResponse>(`${ADMIN_ROOMS}/${encodeURIComponent(symbol)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ operationStatus }),
  });
  return toRoom(result)[0] ?? null;
}

function toRoom(room: RoomResponse): AdminRoom[] {
  if (room.id === undefined || !room.symbol) return [];
  return [
    {
      id: room.id,
      symbol: room.symbol,
      name: coinNameKo(room.symbol, room.name ?? room.symbol),
      active: room.active ?? true,
      operationStatus: room.operationStatus === "OPEN" ? "OPEN" : "CLOSE",
    },
  ];
}
