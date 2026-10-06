import type { components } from "@/lib/api-schema";
import { markdownToPlainText } from "@/lib/format/plain-text";
import { formatRelativeTime } from "@/lib/format/time";
import { http } from "@/lib/http";
import { MARQUEE, TRENDING, VOTES } from "./mock";
import type { FeedPost, HotPost, MarqueeItem, Tier, TrendingRoom, VoteRow } from "./types";

/* eslint-disable no-restricted-imports --
 * 구조 규칙 3은 보유 문구를 features/badge 밖에서 만들지 말라고 하고,
 * 구조 규칙 1은 features 끼리 참조하지 말라고 한다. 둘이 충돌한다.
 *
 * 문구를 여기서 다시 만드는 쪽을 택하지 않았다. 보유 표기는 지갑 특정 방지
 * 장치라 두 곳에서 만들면 한쪽이 새는 순간 전체가 무너진다. 수량 구간이
 * 실제로 그렇게 어긋난 적이 있다.
 *
 * badge 가 lib/ 이나 components/ 로 내려가야 한다는 신호다. 성지 확인 필요.
 */
import { holdingPeriodLabel } from "@/features/badge/label";
/* eslint-enable no-restricted-imports */

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
type PostResponse = Schemas["PostResponse"];
type FeedItemResponse = Schemas["FeedItemResponse"];
type FeedPageResponse = Schemas["FeedPageResponse"];

/** id 가 확인된 글. 목록 key 로 쓰므로 여기서 보장한다. */
type IdentifiedPost = PostResponse & { id: number };

const FEED_SIZE = 20;
const HOT_LIMIT = 5;
const PREVIEW_LENGTH = 120;

/** 전체 글과 핫글. 둘 다 같은 피드 한 번으로 만든다. */
export async function loadFeed(): Promise<{ posts: FeedPost[]; hot: HotPost[] }> {
  const page = await http<FeedPageResponse>(`/api/v1/feed?size=${FEED_SIZE}`);
  const posts = uniquePosts(page.items ?? []).map(toFeedPost);
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

function toFeedPost(post: IdentifiedPost): FeedPost {
  const snapshot = post.holderSnapshot;

  return {
    id: post.id,
    symbol: post.coinSymbol ?? "",
    tier: toTier(snapshot?.verificationLevel, post.verifiedHolder),
    // 서버가 완성해서 주는 문자열이다. 여기서 수량으로 다시 계산하지 않는다.
    range: snapshot?.quantityBand ?? "",
    time: formatRelativeTime(post.createdAt),
    title: post.title ?? "(제목 없음)",
    preview: toPreview(post.content),
    nick: post.author?.nickname ?? "알 수 없음",
    hold: holdingPeriodLabel(snapshot?.holdingMonths),
    comments: post.comments ?? 0,
    // 조회수 API 가 없다. 숫자를 지어내지 않고 화면에서 자리를 뺀다(G-5).
    views: null,
  };
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
      symbol: post.symbol,
      tier: post.tier,
      title: post.title,
      meta: `댓글 ${post.comments}`,
    }));
}

/** 거래소 연동 등급은 백엔드에 아직 없다. WALLET 아니면 전부 미인증이다. */
function toTier(verificationLevel: string | undefined, verifiedHolder: boolean | undefined): Tier {
  if (verificationLevel === "WALLET") return "wallet";
  return verifiedHolder ? "wallet" : "none";
}

/**
 * 본문 미리보기. 본문 포맷(E-2)이 정해지기 전이라 지금은 평문으로 다룬다.
 * 리치텍스트 JSON 으로 바뀌면 여기부터 고친다.
 */
/** 본문은 Markdown 이다. 기호를 걷어낸 평문을 자른다. */
function toPreview(content: string | undefined): string {
  const text = markdownToPlainText(content ?? "");
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}
