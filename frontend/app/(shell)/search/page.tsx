import type { Metadata } from "next";
import SearchView from "@/features/search/components/search-view";
import { safeSymbol } from "@/lib/routes";

type SearchParams = Promise<{ q?: string | string[]; room?: string; page?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const q = first((await searchParams).q).trim();
  return { title: q ? `‘${q}’ 검색 — Hodlit` : "검색 — Hodlit" };
}

/**
 * 검색 결과 (HODL-65 전체 · HODL-69 방). `/search?q=…&room=ETH&page=2`.
 *
 * 검색어는 앞뒤 공백을 자른다. `room` 이 방 심볼 모양이 아니면 전체 검색으로 본다.
 * 쪽 번호가 숫자가 아니거나 1보다 작으면 1쪽이다.
 */
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, room, page } = await searchParams;
  const pageNumber = Number.parseInt(page ?? "", 10);

  return (
    <SearchView
      q={first(q).trim()}
      room={safeSymbol(room)}
      page={Number.isFinite(pageNumber) && pageNumber >= 1 ? pageNumber : 1}
    />
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
