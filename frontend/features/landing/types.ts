/**
 * 랜딩 뷰 모델.
 *
 * `lib/mock/landing.ts` 가 타입과 목데이터를 같이 들고 있던 것을 갈랐다.
 * 목데이터는 `./mock.ts`, 화면에 내려가는 모양은 여기다.
 *
 * 사이드바의 방 목록은 랜딩만의 것이 아니라 셸의 것이라 여기 없다.
 * `components/layout/types.ts` 의 `SidebarRoom` 을 본다.
 */

import type { Tier } from "@/lib/holder-snapshot/types";
import type { PostSummary } from "@/lib/post-summary";

export type MarqueeItem = {
  lead?: string;
  text: string;
  value?: string;
};

export type TrendingRoom = {
  rank: number;
  symbol: string;
  name: string;
  posts: number;
  comments: number;
  hot: boolean;
  latest: string;
};

export type VoteRow = {
  symbol: string;
  allWidth: string;
  allLabel: string;
  holderWidth: string;
  holderLabel: string;
};

export type HotPost = {
  rank: number;
  href: string;
  /** 보유 인증을 지원하는 코인의 글인지. false 면 인증 배지를 그리지 않는다. */
  verifiable: boolean;
  symbol: string;
  tier: Tier;
  title: string;
  meta: string;
};

/**
 * 전체 글 한 줄. 방 게시판과 같은 카드라 모양은 `lib/post-summary.ts` 에 있다.
 */
export type FeedPost = PostSummary;
