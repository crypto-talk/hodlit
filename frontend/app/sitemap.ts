import type { MetadataRoute } from "next";
import { loadSitemapPosts, loadSitemapRooms } from "@/features/sitemap/api";
import { sitemapEntries } from "@/features/sitemap/entries";
import { siteOrigin } from "@/lib/site-origin";

/**
 * `/sitemap.xml`. 검색엔진 · AI 크롤러에게 공개 화면의 주소를 직접 알려 준다.
 *
 * 홈과 방 게시판은 아직 브라우저에서 글 목록을 그려서, 자바스크립트를 돌리지 않는 크롤러는
 * 거기서 글 주소를 찾지 못한다. 글 상세는 서버에서 그려지므로(#105) 주소만 알면 읽을 수 있다.
 *
 * 주소의 앞부분은 요청이 들어온 사이트 주소다(`siteOrigin`). 그래서 요청마다 만든다.
 * 백엔드 응답은 `features/sitemap/api.ts` 가 캐시한다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, rooms, posts] = await Promise.all([
    siteOrigin(),
    loadSitemapRooms(),
    loadSitemapPosts(),
  ]);
  return sitemapEntries(origin, rooms, posts);
}
