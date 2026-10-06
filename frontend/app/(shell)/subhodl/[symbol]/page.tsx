import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RoomBoard from "@/features/room/components/room-board";
import { safeSymbol } from "@/lib/routes";

type Params = Promise<{ symbol: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { symbol } = await params;
  const room = safeSymbol(symbol);
  return { title: room ? `${room} 방 — Hodlit` : "Hodlit" };
}

/**
 * 방 게시판. 주소는 `/subhodl/[symbol]` (A-2), 탭은 `?tab=verified` (구조 규칙 8).
 *
 * 심볼 모양이 아니면 요청을 보내지 않고 바로 404 다. 모양은 맞는데 없는 방은
 * 백엔드가 404 를 주고 화면 안에서 알린다.
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ symbol }, { tab }] = await Promise.all([params, searchParams]);
  const room = safeSymbol(symbol);
  if (!room) notFound();

  return <RoomBoard symbol={room} tab={tab === "verified" ? "verified" : "all"} />;
}
