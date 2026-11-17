import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-origin";

/**
 * `/robots.txt`. 모든 크롤러(검색엔진 · AI 크롤러)에 공개 화면을 열고, sitemap 위치를 알린다.
 *
 * 막는 곳은 검색에 나올 이유가 없거나 주소가 끝없이 생기는 화면이다.
 * - 관리자 · 마이페이지 · 글쓰기 · 글 수정: 로그인해야 내용이 있다. 관리자는 `noindex` 도 붙어 있다
 * - 로그인 · 회원가입: `?next=` 마다 주소가 달라진다
 * - 검색 결과: 검색어마다 주소가 생긴다
 *
 * 여기서 막는 것은 크롤링이지 접근이 아니다. 관리 화면을 실제로 막는 것은 백엔드의 403 이다.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/mypage",
        "/write",
        "/subhodl/*/*/edit",
        "/login",
        "/signup",
        "/search",
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
