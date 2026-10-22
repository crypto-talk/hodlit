import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RoomBoard from "@/features/room/components/room-board";
import RoomPoll from "@/features/vote/components/room-poll";
import { safeSymbol } from "@/lib/routes";

type Params = Promise<{ symbol: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { symbol } = await params;
  const room = safeSymbol(symbol);
  return { title: room ? `${room} 방 — Hodlit` : "Hodlit" };
}

/**
 * 방 게시판. 주소는 `/subhodl/[symbol]` (A-2), 탭은 `?tab=verified`, 쪽은 `?page=2` (구조 규칙 8).
 * 쪽 번호가 숫자가 아니거나 1보다 작으면 1쪽으로 본다.
 *
 * 심볼 모양이 아니면 요청을 보내지 않고 바로 404 다. 모양은 맞는데 없는 방은
 * 백엔드가 404 를 주고 화면 안에서 알린다.
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const [{ symbol }, { tab, page }] = await Promise.all([params, searchParams]);
  const room = safeSymbol(symbol);
  if (!room) notFound();

  const pageNumber = Number.parseInt(page ?? "", 10);

  return (
    <RoomBoard
      symbol={room}
      tab={tab === "verified" ? "verified" : "all"}
      page={Number.isFinite(pageNumber) && pageNumber >= 1 ? pageNumber : 1}
      poll={<RoomPoll symbol={room} />}
    />
  );
}
