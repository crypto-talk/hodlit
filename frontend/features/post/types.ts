/**
 * 글쓰기 화면이 쓰는 뷰 모델.
 *
 * 백엔드 DTO 는 `lib/api-schema.ts` 에 생성돼 있다. 응답 타입은 모든 필드가
 * 선택(`?`)이라 `api.ts` 에서 한 번 좁혀 여기 모양으로 넘긴다.
 */

/** 방 선택 드롭다운의 한 줄. */
export type WriteRoom = {
  symbol: string;
  /** 한글명. 매핑표에 없으면 백엔드 영문명. */
  name: string;
};

/** 발행 직후 화면이 알아야 하는 것. 글 상세 화면이 생기면 이 id 로 이동한다. */
export type PublishedPost = {
  id: number;
  coinSymbol: string;
};

/**
 * 글쓰기 1단계 입력값.
 *
 * 이미지·차트·유튜브는 아직 없다. 본문 포맷(E-2) 결정은 에디터에만 걸리고,
 * 백엔드 `content` 는 어느 쪽이든 5000자 문자열이다.
 */
export type PostDraft = {
  coinSymbol: string;
  title: string;
  content: string;
};
