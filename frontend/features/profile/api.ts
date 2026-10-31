import { http } from "@/lib/http";
import type { PublicProfile, ProfilePage } from "./types";

export const loadProfile = (nickname: string) =>
  http<PublicProfile>(`/api/v1/members/by-nickname?${new URLSearchParams({ nickname })}`);
export const loadProfileItems = (id: number, tab: "posts" | "comments", page: number) =>
  http<ProfilePage>(`/api/v1/members/${id}/${tab}/page?page=${page}&size=20`);

export type AssetVisibility = { symbol: string; name: string; visible: boolean };
export const loadAssetVisibility = () => http<AssetVisibility[]>("/api/v1/me/asset-visibility");
export const saveAssetVisibility = (symbol: string, visible: boolean) =>
  http<AssetVisibility>(`/api/v1/me/asset-visibility/${encodeURIComponent(symbol)}`, {
    method: "PUT",
    body: JSON.stringify({ visible }),
  });
