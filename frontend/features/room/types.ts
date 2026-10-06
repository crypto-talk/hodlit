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
  /**
   * 글 수. ⚠️ 백엔드가 최신 100개까지만 세서 100 에서 멈춘다.
   * 화면은 `postCountCapped` 가 true 면 "100개 이상"으로 쓴다.
   */
  postCount: number;
  postCountCapped: boolean;
  /** 보유 인증 지원 여부. 서버의 `verificationAvailability` 를 따른다. */
  verifiable: boolean;
  /** 방 강조색. 없으면 null 이고 화면은 브랜드색을 쓴다. */
  accentColor: string | null;
};

/** 방 시세. `GET /market/prices/{symbol}?currency=KRW` 에서 온다. */
export type RoomPrice = {
  /** 원화 가격. */
  price: number;
  /** 24시간 등락률 문자열. `+2.4%` / `-` */
  change: string;
  direction: "up" | "down" | "flat";
  /** 서버가 시세를 찍은 시각(ISO). 없으면 빈 문자열. */
  capturedAt: string;
};
