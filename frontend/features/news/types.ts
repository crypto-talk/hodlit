/** 방 뉴스 한 건 (`GET /communities/{symbol}/news`, HODL-62). 관리자가 직접 등록한 것이다. */
export type RoomNewsItem = {
  id: number;
  title: string;
  summary: string;
  sourceName: string;
  /** 원문 주소. http(s) 가 아니면 null — 링크를 그리지 않는다. */
  sourceUrl: string | null;
  createdAt: string;
};

export type RoomNewsPage = {
  items: RoomNewsItem[];
  /** 화면 기준 1부터. */
  page: number;
  totalPages: number;
  totalItems: number;
};
