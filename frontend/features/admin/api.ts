import type { components } from "@/lib/api-schema";
import { coinNameKo } from "@/lib/coin-name-ko";
import type { RoomOperationStatus } from "@/lib/room-status";
import type { AdminRoomFilter } from "@/lib/routes";
import { http } from "@/lib/http";
import type {
  AdminRoom,
  AdminRoomPage,
  BadgeConfig,
  BadgePresets,
  Category,
  ModerationLog,
  ModerationRow,
  Page,
} from "./types";

const ROOT = "/api/v1/admin";

export const loadCategories = () => http<Category[]>(`${ROOT}/room-categories`);
export const loadBadgeConfig = (symbol: string) =>
  http<BadgeConfig>(`${ROOT}/communities/${encodeURIComponent(symbol)}/badge-config`);
export const loadBadgePresets = () => http<BadgePresets>(`${ROOT}/badge-presets`);
export const saveBadgeConfig = (symbol: string, config: BadgeConfig) =>
  http<BadgeConfig>(`${ROOT}/communities/${encodeURIComponent(symbol)}/badge-config`, {
    method: "PUT",
    body: JSON.stringify({ expectedVersion: config.version, tiers: config.tiers }),
  });
export const createRoom = (body: {
  symbol: string;
  name: string;
  displayOrder: number;
  categoryId: number | null;
}) => http<AdminRoom>(`${ROOT}/communities`, { method: "POST", body: JSON.stringify(body) });
export const updateRoom = (room: AdminRoom) =>
  http<AdminRoom>(`${ROOT}/communities/${encodeURIComponent(room.symbol)}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: room.name,
      displayOrder: room.displayOrder,
      categoryId: room.categoryId,
      active: room.active,
    }),
  });
export const deleteRoom = (symbol: string) =>
  http<void>(`${ROOT}/communities/${encodeURIComponent(symbol)}`, { method: "DELETE" });
export const saveCategory = (id: number | null, name: string, displayOrder: number) =>
  http<Category>(`${ROOT}/room-categories${id === null ? "" : `/${id}`}`, {
    method: id === null ? "POST" : "PATCH",
    body: JSON.stringify({ name, displayOrder }),
  });
export const deleteCategory = (id: number) =>
  http<void>(`${ROOT}/room-categories/${id}`, { method: "DELETE" });
export const loadModeration = (
  type: "posts" | "members",
  q: string,
  state: string,
  page: number,
) => {
  const params = new URLSearchParams({ q, page: String(page), size: "20" });
  if (state) params.set("state", state);
  return http<Page<ModerationRow>>(`${ROOT}/${type}?${params}`);
};
export const loadModerationDetail = (type: "posts" | "members", id: number) =>
  http<ModerationRow>(`${ROOT}/${type}/${id}`);
export const changeModeration = (
  type: "posts" | "members",
  id: number,
  enabled: boolean,
  reason: string,
) =>
  http<ModerationRow>(`${ROOT}/${type}/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ enabled, reason }),
  });
export const loadModerationLogs = (page: number) =>
  http<Page<ModerationLog>>(`${ROOT}/moderation-logs?page=${page}&size=20`);

const ADMIN_ROOMS = `${ROOT}/communities`;
export const ADMIN_ROOM_PAGE_SIZE = 20;
type Schemas = components["schemas"];
type RoomResponse = Schemas["RoomResponse"];
type RoomPageResponse = Schemas["PageResponseRoomResponse"];
type ChangeStatusRequest = Schemas["ChangeStatusRequest"];
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
    body: JSON.stringify({ operationStatus } satisfies ChangeStatusRequest),
  });
  return toRoom(result)[0] ?? null;
}

function toRoom(room: RoomResponse): AdminRoom[] {
  if (room.id === undefined || !room.symbol) return [];
  return [
    {
      id: room.id,
      catalogName: room.name ?? room.symbol,
      displayOrder: room.displayOrder ?? 0,
      categoryId: room.categoryId ?? null,
      symbol: room.symbol,
      name: coinNameKo(room.symbol, room.name ?? room.symbol),
      active: room.active ?? true,
      // 값이 없으면 열린 것으로 본다. 사용자 화면의 `isOpenRoom()` 과 같은 기준이다.
      operationStatus: room.operationStatus === "CLOSE" ? "CLOSE" : "OPEN",
    },
  ];
}
