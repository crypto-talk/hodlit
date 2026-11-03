import type { AnimalBadgeData } from "@/components/holder/animal-badge";

export type ProfileAsset = {
  coinSymbol: string;
  coinName: string;
  quantityBand: string;
  holdingMonths: number | null;
  syncStatus: string;
};
export type PublicProfile = {
  representativeBadge?: AnimalBadgeData | null;
  id: number;
  nickname: string;
  avatarColor: string;
  joinedAt?: string;
  createdAt?: string;
  postCount: number;
  commentCount: number;
  assets: ProfileAsset[];
};
export type ProfileSnapshot = {
  quantityBand?: string;
  holdingMonths?: number;
  capturedAt?: string;
  holderStatus?: string;
  syncStatus?: string;
  badge?: AnimalBadgeData;
};
export type ProfileItem = {
  id: number;
  coinSymbol: string;
  title?: string;
  content: string;
  createdAt: string;
  postId?: number;
  postTitle?: string;
  holderSnapshot?: ProfileSnapshot | null;
};
export type ProfilePage = { items: ProfileItem[]; totalPages: number; totalElements: number };
