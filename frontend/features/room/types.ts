import type { PostSummary } from "@/lib/post-summary";

/**
 * 방 게시판 뷰 모델.
 *
 * 사이드바의 방 목록 모양은 셸의 것이라 `components/layout/types.ts` 의
 * `SidebarRoom` 이다. 여기는 방 게시판 화면만 쓰는 모양이다.
 */

/** 방 머리. `GET /communities/{symbol}` 에서 온다. */
export type RoomInfo = {
  symbol: string;
  /** 한글명. 매핑표에 없으면 백엔드 영문명. */
  name: string;
  description: string;
  /** 글 수. 서버가 방의 글 전체를 센 값이다(예전엔 100 에서 멈췄다). */
  postCount: number;
  /** 보유 인증 지원 여부. 서버의 `verificationAvailability` 를 따른다. */
  verifiable: boolean;
  /** 방 강조색. 없으면 null 이고 화면은 브랜드색을 쓴다. */
  accentColor: string | null;
  /** 관리자가 닫은 방(HODL-77). 글 · 시세 · 투표 · 뉴스 대신 안내만 보인다. */
  closed: boolean;
};

/** 방 글 목록 한 쪽. `GET /communities/{symbol}/posts/page` 에서 온다. */
export type RoomPostPage = {
  posts: PostSummary[];
  /** 전체 쪽 수. 글이 없으면 0. */
  totalPages: number;
  /** 이 탭 기준 전체 글 수. */
  totalPosts: number;
};
