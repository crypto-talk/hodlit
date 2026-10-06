import type { components } from "@/lib/api-schema";
import { http } from "@/lib/http";
import { type IdentifiedPost, toPostSummary } from "@/lib/post-summary";
import { MARQUEE, TRENDING, VOTES } from "./mock";
import type { FeedPost, HotPost, MarqueeItem, TrendingRoom, VoteRow } from "./types";

/**
 * 랜딩이 가져오는 데이터 (구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * 방 목록은 셸의 것이라 여기 없다. `features/room/api.ts` 를 본다.
 *
 * ⚠️ `lib/api-schema.ts` 의 응답 타입은 모든 필드가 선택(`?`)이다. 백엔드가
 * 응답 스키마에 required 를 안 내보내서다. 게다가 Jackson 설정이
 * `default-property-inclusion: non_null` 이라 null 필드는 아예 빠져서 온다.
 * 그래서 여기서 한 번 좁히고, 화면은 좁혀진 뷰 모델만 받는다.
 */

type Schemas = components["schemas"];
type FeedItemResponse = Schemas["FeedItemResponse"];
type FeedPageResponse = Schemas["FeedPageResponse"];

const FEED_SIZE = 20;
const HOT_LIMIT = 5;

/** 전체 글과 핫글. 둘 다 같은 피드 한 번으로 만든다. */
export async function loadFeed(): Promise<{ posts: FeedPost[]; hot: HotPost[] }> {
  const page = await http<FeedPageResponse>(`/api/v1/feed?size=${FEED_SIZE}`);
  const posts = uniquePosts(page.items ?? []).map(toPostSummary);
  return { posts, hot: toHotPosts(posts) };
}

/*
 * 아래 셋은 백엔드에 API 자체가 없어서 목데이터를 그대로 돌려준다.
 * 화면이 `./mock` 을 직접 읽지 않게 하려고(구조 규칙 2) 여기를 통과시킨다.
 * API 가 생기면 이 함수만 async 로 바꾸면 화면은 그대로 둘 수 있다.
 */

/** ⚠️ 목값. 랜딩 집계 API 없음. 오픈 전에 진짜 값으로 바꾸거나 빼야 한다. */
export function marqueeItems(): MarqueeItem[] {
  return MARQUEE;
}

/** ⚠️ 목값. 방별 24h 글·댓글 집계 API 없음 (G-3 미합의). */
export function trendingRooms(): TrendingRoom[] {
  return TRENDING;
}

/** ⚠️ 목값. 일일 투표 기능 자체가 백엔드에 없음 (G-5). */
export function dailyVotes(): VoteRow[] {
  return VOTES;
}

/**
 * `/feed` 는 글 목록이 아니라 활동 피드다. 재게시가 섞여서 같은 글이 여러 번
 * 올 수 있다. 먼저 올라온 활동을 남기고 뒤의 중복은 버린다.
 */
function uniquePosts(items: FeedItemResponse[]): IdentifiedPost[] {
  const seen = new Set<number>();
  const posts: IdentifiedPost[] = [];

  for (const item of items) {
    const post = item.post;
    if (!post || typeof post.id !== "number" || seen.has(post.id)) continue;
    seen.add(post.id);
    posts.push(post as IdentifiedPost);
  }

  return posts;
}

/**
 * 핫글.
 *
 * ⚠️ 집계 기준(G-3)이 백엔드와 미합의고 조회수 API 도 없다. 지금은 가져온
 * 피드 안에서 댓글 많은 순으로만 세운 **임시** 목록이다. 전체 글 중 진짜
 * 상위가 아니다. 기준이 정해지면 백엔드 집계로 바꾼다.
 */
function toHotPosts(posts: FeedPost[]): HotPost[] {
  return [...posts]
    .sort((a, b) => b.comments - a.comments)
    .slice(0, HOT_LIMIT)
    .map((post, index) => ({
      rank: index + 1,
      href: post.href,
      verifiable: post.verifiable,
      symbol: post.symbol,
      tier: post.tier,
      title: post.title,
      meta: `댓글 ${post.comments}`,
    }));
}
