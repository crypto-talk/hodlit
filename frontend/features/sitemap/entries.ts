import type { MetadataRoute } from "next";
import { postHref, roomHref } from "@/lib/routes";

/**
 * `sitemap.xml` 에 넣을 주소 목록을 만드는 순수 함수. 데이터는 `api.ts` 가 받는다.
 *
 * 넣는 것은 검색에 나올 만한 공개 화면뿐이다 — 홈 · 열린 방 게시판 · 열린 방의 글.
 * 닫힌 방과 그 글은 서버가 403 으로 막으니 넣지 않는다(목록 API 가 이미 뺀다).
 * 마이페이지 · 관리자 · 글쓰기 · 검색 결과는 `app/robots.ts` 가 막는다.
 *
 * `changeFrequency` · `priority` 는 넣지 않는다. 구글이 읽지 않는 값이다.
 */

export type SitemapPost = {
  id: number;
  symbol: string;
  /** 마지막으로 바뀐 시각(ISO). 수정한 적 없으면 작성 시각. 알 수 없으면 null. */
  updatedAt: string | null;
};

export function sitemapEntries(
  origin: string,
  rooms: string[],
  posts: SitemapPost[],
): MetadataRoute.Sitemap {
  const latestByRoom = new Map<string, Date>();
  let latestOverall: Date | undefined;

  const postEntries = posts.map((post) => {
    const updated = parseDate(post.updatedAt);
    if (updated) {
      latestOverall = later(latestOverall, updated);
      latestByRoom.set(post.symbol, later(latestByRoom.get(post.symbol), updated));
    }
    return {
      url: `${origin}${postHref(post.symbol, post.id)}`,
      lastModified: updated,
    };
  });

  const roomEntries = rooms.map((symbol) => ({
    url: `${origin}${roomHref(symbol)}`,
    lastModified: latestByRoom.get(symbol),
  }));

  return [{ url: `${origin}/`, lastModified: latestOverall }, ...roomEntries, ...postEntries];
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function later(current: Date | undefined, next: Date): Date {
  return current && current >= next ? current : next;
}
