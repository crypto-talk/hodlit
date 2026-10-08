import type { Tier } from "@/lib/holder-snapshot/types";

/**
 * 글쓰기 화면이 쓰는 뷰 모델.
 *
 * 백엔드 DTO 는 `lib/api-schema.ts` 에 생성돼 있다. 응답 타입은 모든 필드가
 * 선택(`?`)이라 `api.ts` 에서 한 번 좁혀 여기 모양으로 넘긴다.
 */

/** 방 선택 드롭다운의 한 줄. */
export type WriteRoom = {
  symbol: string;
  /** 보유 인증 지원 여부. 서버의 `verificationAvailability` 를 따른다. */
  verifiable: boolean;
  /** 한글명. 매핑표에 없으면 백엔드 영문명. */
  name: string;
};

/** 발행 직후 화면이 알아야 하는 것. 글 상세 화면이 생기면 이 id 로 이동한다. */
export type PublishedPost = {
  id: number;
  coinSymbol: string;
};

/**
 * 업로드가 끝난 이미지.
 *
 * `url` 은 백엔드가 준 상대 경로(`/api/v1/media/<uuid>.jpg`)다. 발행할 때는
 * 이 값을 그대로 보낸다. 서버가 이 경로로 업로드 기록을 찾아 글에 묶는다.
 */
export type UploadedImage = {
  url: string;
};

/**
 * 글쓰기 입력값.
 *
 * 차트는 아직 없다. 본문 포맷(E-2) 결정은 에디터에만 걸리고, 백엔드
 * `content` 는 어느 쪽이든 5000자 문자열이다.
 */
export type PostDraft = {
  coinSymbol: string;
  title: string;
  content: string;
  /** 업로드가 끝난 이미지만. 올린 순서가 글의 순서다. */
  images: UploadedImage[];
  /** 비어 있으면 보내지 않는다. */
  youtubeUrl: string;
  /**
   * 고른 방이 보유 인증을 지원하는지. true 면 발행 직전에 보유 기록을 갱신한다.
   * 지원하지 않는 방(BTC 등)은 갱신해도 글에 붙을 것이 없어 RPC 를 부르지 않는다.
   */
  verifiable: boolean;
};

/**
 * 글에 붙은 보유 정보를 화면 문구로 바꾼 것. 문구는 전부
 * `lib/holder-snapshot/label.ts` 가 만든다(구조 규칙 3).
 */
export type HolderView = {
  /** 이 코인이 보유 인증을 지원하는지. false 면 배지·기간·구간을 그리지 않는다. */
  verifiable: boolean;
  tier: Tier;
  /** 서버가 완성한 구간. 미인증이면 null. */
  amount: string | null;
  holding: string;
};

/** 글 상세 뷰 모델. */
export type PostDetail = {
  id: number;
  coinSymbol: string;
  title: string;
  /** Markdown. 예전 글은 평문이고, 평문도 그대로 유효한 Markdown 이다. */
  content: string;
  /** 댓글에서 "작성자" 표시에 쓴다. 응답에 없으면 null. */
  authorId: number | null;
  authorNickname: string;
  createdAt: string;
  /** 수정된 적이 있으면 true. 스냅샷은 그대로고 본문만 바뀐다. */
  edited: boolean;
  images: { id: string; src: string }[];
  youtubeVideoId: string | null;
  /** 작성 시점 가격. 서버가 발행 순간 찍은 값이다. */
  price: { value: number; currency: string } | null;
  comments: number;
  /** 발행 시점에 고정된 보유 정보. 응답에 없으면 null. */
  holder: HolderView | null;
} & PostReactions;

/**
 * 좋아요 · 북마크 상태. 누를 때마다 서버가 글 전체를 돌려주는데, 화면이 바꿔
 * 끼우는 것은 이 부분뿐이다.
 *
 * `liked` · `bookmarked` 는 요청에 토큰이 실렸을 때만 의미가 있다. 로그인 전에
 * 받은 글은 둘 다 false 다.
 */
export type PostReactions = {
  likes: number;
  liked: boolean;
  bookmarked: boolean;
};

/** 북마크한 글 한 줄. */
export type BookmarkedPost = {
  id: number;
  coinSymbol: string;
  title: string;
  createdAt: string;
};
