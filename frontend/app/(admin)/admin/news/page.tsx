import type { Metadata } from "next";
import NewsManager from "@/features/admin/components/news-manager";
import { adminRoomParam } from "@/lib/routes";

export const metadata: Metadata = {
  title: "뉴스 관리 — Hodlit 관리자",
};

/**
 * 관리자 방 뉴스 관리 (HODL-110). `?room=ETH` 고른 방, `?page=` (1부터).
 * 모양이 아닌 값은 무시한다.
 */
export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; page?: string }>;
}) {
  const { room, page } = await searchParams;
  const pageNumber = page && /^\d+$/.test(page) ? Number(page) : 1;

  return (
    <NewsManager
      room={adminRoomParam(room)}
      page={Number.isSafeInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1}
    />
  );
}
