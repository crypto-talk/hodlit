import { http } from "@/lib/http";
import type {
  AdminRoom,
  BadgeConfig,
  BadgePresets,
  Category,
  ModerationLog,
  ModerationRow,
  Page,
} from "./types";

const ROOT = "/api/v1/admin";

export const checkAdmin = () => http<{ admin: boolean }>(`${ROOT}/access`);
export const loadAdminRooms = (q: string, page: number) =>
  http<Page<AdminRoom>>(
    `${ROOT}/communities?${new URLSearchParams({ q, page: String(page), size: "20" })}`,
  );
export const loadCategories = () => http<Category[]>(`${ROOT}/room-categories`);
export const loadBadgeConfig = (symbol: string) =>
  http<BadgeConfig>(`${ROOT}/communities/${encodeURIComponent(symbol)}/badge-config`);
export const loadBadgePresets = () => http<BadgePresets>(`${ROOT}/badge-presets`);
export const saveBadgeConfig = (symbol: string, config: BadgeConfig) =>
  http<BadgeConfig>(`${ROOT}/communities/${encodeURIComponent(symbol)}/badge-config`, {
    method: "PUT",
    body: JSON.stringify({ expectedVersion: config.version, tiers: config.tiers }),
  });
export const changeRoomStatus = (symbol: string, operationStatus: string) =>
  http<AdminRoom>(`${ROOT}/communities/${encodeURIComponent(symbol)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ operationStatus }),
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
