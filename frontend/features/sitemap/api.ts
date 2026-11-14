import type { components } from "@/lib/api-schema";
import { http } from "@/lib/http";
import { isOpenRoom } from "@/lib/room-status";
import type { SitemapPost } from "./entries";

/**
 * `sitemap.xml` 이 쓰는 데이터 (구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * 다른 feature 의 `api.ts` 를 부를 수 없어서(구조 규칙 1) 방 목록 · 글 목록 요청을 여기 따로 둔다.
 * 둘 다 공개 API 라 Next 서버가 비로그인으로 부른다.
 *
 * 크롤러가 sitemap 을 열 때마다 백엔드를 다시 부르지 않도록 응답을 Next 데이터 캐시에 10분 둔다.
 * 실패하면 받은 데까지만 돌려준다 — sitemap 이 통째로 깨지는 것보다 낫다.
 */

type CoinResponse = components["schemas"]["CoinResponse"];
type PostPageResponse = components["schemas"]["PageResponsePostResponse"];

/** 백엔드 번호 페이지가 받는 가장 큰 쪽 크기(`docs/NUMBERED_PAGINATION_API.md`). */
const PAGE_SIZE = 100;
/** 글을 이만큼(5000개)까지만 넣는다. sitemap 한 파일의 한도는 5만 개다. 넘으면 sitemap 을 나눈다. */
const MAX_PAGES = 50;
const CACHE_SECONDS = 600;
const TIMEOUT_MS = 5000;

function requestInit(): RequestInit {
  return {
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
}

/** 열린 방의 심볼. 닫힌 방(HODL-77)은 빼고 기타 방은 넣는다. 실패하면 빈 목록. */
export async function loadSitemapRooms(): Promise<string[]> {
  try {
    const coins = await http<CoinResponse[]>("/api/v1/coins", requestInit());
    return coins
      .filter(isOpenRoom)
      .map((coin) => coin.symbol)
      .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0);
  } catch {
    return [];
  }
}

/**
 * 열린 방의 글 전부(최신순). `/posts/page` 는 재게시를 빼고 글마다 한 번씩, 닫힌 방 · 숨긴 글을
 * 뺀 목록이다. 중간에 실패하면 그때까지 받은 글만 돌려준다.
 */
export async function loadSitemapPosts(): Promise<SitemapPost[]> {
  const posts: SitemapPost[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let result: PostPageResponse;
    try {
      result = await http<PostPageResponse>(
        `/api/v1/posts/page?page=${page}&size=${PAGE_SIZE}`,
        requestInit(),
      );
    } catch {
      break;
    }

    for (const post of result.items ?? []) {
      if (typeof post.id !== "number" || !post.coinSymbol) continue;
      posts.push({
        id: post.id,
        symbol: post.coinSymbol,
        updatedAt: post.updatedAt ?? post.createdAt ?? null,
      });
    }

    if (!result.hasNext) break;
  }

  return posts;
}
