import type { Metadata } from "next";
import RoomManager from "@/features/admin/components/room-manager";
import type { AdminRoomFilter } from "@/lib/routes";

export const metadata: Metadata = {
  title: "방 관리 — Hodlit 관리자",
};

/**
 * 관리자 방 관리 (HODL-78). `?q=` 검색어, `?status=open|closed`, `?page=` (1부터).
 * 모양이 아닌 값은 무시한다.
 */
export default async function AdminRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page } = await searchParams;
  const filter: AdminRoomFilter | null = status === "open" || status === "closed" ? status : null;
  const pageNumber = page && /^\d+$/.test(page) ? Number(page) : 1;

  return (
    <RoomManager
      q={(q ?? "").trim().slice(0, 100)}
      status={filter}
      page={Number.isSafeInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1}
    />
  );
}
