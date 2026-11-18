import type { AnimalBadgeData } from "@/components/holder/animal-badge";
import type { AttachedSnapshotRow } from "@/lib/holder-snapshot/attachments";

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
  /** 글에만 온다. 방 코인 + 고른 코인의 작성 시점 기록(공개된 것만, HODL-106). */
  attachedCoinSnapshots?: AttachedSnapshotRow[];
};
export type ProfilePage = { items: ProfileItem[]; totalPages: number; totalElements: number };
