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
  symbol: string;
  tier: Tier;
  title: string;
  meta: string;
};

export type FeedPost = {
  id: number;
  /** 글 상세 주소. */
  href: string;
  symbol: string;
  tier: Tier;
  /** 수량 구간. **서버가 완성해서 주는 문자열**이다. 프론트가 계산하지 않는다. */
  range: string;
  time: string;
  title: string;
  preview: string;
  nick: string;
  /** 보유 기간 문구. lib/holder-snapshot/label.ts 가 만든다. 인덱서 전까지 항상 `보유 기간 미확인`. */
  hold: string;
  comments: number;
  /** ⚠️ 조회수 API 가 없다. null 이면 화면에서 자리를 뺀다. */
  views: number | null;
};
