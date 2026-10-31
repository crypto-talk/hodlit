import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsListPage from "@/features/news/components/news-list-page";
import { safeSymbol } from "@/lib/routes";

type Params = Promise<{ symbol: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { symbol } = await params;
  const room = safeSymbol(symbol);
  return { title: room ? `${room} 뉴스 — Hodlit` : "Hodlit" };
}

/**
 * 방 뉴스 목록. 방 게시판 뉴스 칸의 "더보기". 쪽은 `?page=2` (구조 규칙 8), 숫자가 아니면 1쪽.
 * 심볼 모양이 아니면 요청 없이 404 다.
 */
export default async function RoomNewsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ symbol }, { page }] = await Promise.all([params, searchParams]);
  const room = safeSymbol(symbol);
  if (!room) notFound();

  const pageNumber = Number.parseInt(page ?? "", 10);

  return (
    <NewsListPage
      symbol={room}
      page={Number.isFinite(pageNumber) && pageNumber >= 1 ? pageNumber : 1}
    />
  );
}
