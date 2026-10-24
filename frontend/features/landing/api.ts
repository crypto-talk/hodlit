import type { components } from "@/lib/api-schema";
import { coinNameKo } from "@/lib/coin-name-ko";
import { http } from "@/lib/http";
import { type IdentifiedPost, toPostSummary } from "@/lib/post-summary";
import type { FeedPost, TrendingRoom } from "./types";

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
type StatisticsResponse = Schemas["StatisticsResponse"];

const FEED_SIZE = 20;
/** 지금 뜨는 방에 보여주는 방 수. 1~3위는 카드, 나머지는 줄. */
const TRENDING_LIMIT = 6;

/** 전체 글. */
export async function loadFeed(): Promise<FeedPost[]> {
  const page = await http<FeedPageResponse>(`/api/v1/feed?size=${FEED_SIZE}`);
  return uniquePosts(page.items ?? []).map(toPostSummary);
}

/**
 * 지금 뜨는 방 (HODL-44, `docs/COMMUNITY_STATISTICS_API.md`).
 *
 * 서버가 이미 순위를 매겨 준다. 여기서 다시 정렬하지 않고 앞에서부터 자른다.
 * 최근 24시간 동안 글 · 댓글 · 좋아요를 남긴 사람 수(최근일수록 점수가 높다)로 매기고
 * 조회수 · 인증 여부 · 시세는 순위에 안 들어간다. 활동이 있는 방이 없으면 빈 배열이고
 * 에러가 아니다.
 */
export async function loadTrendingRooms(): Promise<TrendingRoom[]> {
  const stats = await http<StatisticsResponse>("/api/v1/communities/stats?window=24h");

  return (stats.rooms ?? [])
    .filter((room): room is typeof room & { symbol: string } => !!room.symbol)
    .slice(0, TRENDING_LIMIT)
    .map((room, index) => ({
      rank: index + 1,
      symbol: room.symbol,
      // 통계 응답에는 이름이 없다. 한글명 표에 없으면 심볼을 그대로 쓴다.
      name: coinNameKo(room.symbol, room.symbol),
      posts: room.postCount ?? 0,
      comments: room.commentCount ?? 0,
      participants: room.activeParticipantCount ?? 0,
    }));
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
