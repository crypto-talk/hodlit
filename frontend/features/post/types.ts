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
};

/**
 * 글 상세 뷰 모델.
 *
 * ⚠️ 보유 스냅샷(배지·수량 구간·보유 기간)은 아직 싣지 않는다. 그 문구는
 * `features/badge` 에서만 만들어야 하는데(구조 규칙 3), features 끼리 참조할 수
 * 없다(구조 규칙 1). badge 를 lib 로 내릴지 정한 뒤에 붙인다.
 */
export type PostDetail = {
  id: number;
  coinSymbol: string;
  title: string;
  /** Markdown. 예전 글은 평문이고, 평문도 그대로 유효한 Markdown 이다. */
  content: string;
  authorNickname: string;
  createdAt: string;
  /** 수정된 적이 있으면 true. 스냅샷은 그대로고 본문만 바뀐다. */
  edited: boolean;
  images: { id: string; src: string }[];
  youtubeVideoId: string | null;
  /** 작성 시점 가격. 서버가 발행 순간 찍은 값이다. */
  price: { value: number; currency: string } | null;
  likes: number;
  comments: number;
};
