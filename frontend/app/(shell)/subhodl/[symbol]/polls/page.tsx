import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PollResultsPage from "@/features/vote/components/poll-results-page";
import { isGeneralRoom } from "@/lib/room-status";
import { parsePage, safeSymbol } from "@/lib/routes";

type Params = Promise<{ symbol: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { symbol } = await params;
  const room = safeSymbol(symbol);
  return room ? { title: `${room} 지난 투표` } : {};
}

/**
 * 방의 지난 투표 결과 (HODL-109). 쪽은 `?page=2` (구조 규칙 8), 숫자가 아니면 1쪽.
 * 심볼 모양이 아니거나 투표가 없는 기타 방이면 요청 없이 404 다.
 */
export default async function RoomPollResultsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ symbol }, { page }] = await Promise.all([params, searchParams]);
  const room = safeSymbol(symbol);
  if (!room || isGeneralRoom(room)) notFound();

  return <PollResultsPage symbol={room} page={parsePage(page)} />;
}
