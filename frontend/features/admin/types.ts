export type Page<T> = {
  items: T[];
  page: number;
  totalPages: number;
  totalElements: number;
};

export type AdminRoom = {
  id: number;
  catalogName?: string;
  symbol: string;
  name: string;
  active: boolean;
  operationStatus: "OPEN" | "CLOSE";
  displayOrder: number;
  categoryId: number | null;
};

export type Category = { id: number; name: string; displayOrder: number };
export type BadgeTier = {
  name: string;
  minimumQuantity: string | number;
  icon: string;
  color: string;
  effect: string;
};
export type BadgeConfig = { symbol: string; version: number; tiers: BadgeTier[] };
export type BadgePresets = { icons: string[]; colors: string[]; effects: string[] };

export type ModerationRow = {
  id: number;
  title?: string;
  content?: string;
  nickname?: string;
  symbol?: string;
  role?: string;
  hidden?: boolean;
  suspended?: boolean;
  created_at?: string;
};
export type ModerationLog = {
  id: number;
  actor_id: number;
  target_type: string;
  target_id: number;
  before_state: string;
  after_state: string;
  reason: string;
  created_at: string;
};

export type AdminRoomPage = Page<AdminRoom>;

/** 방 뉴스 한 건(HODL-110). 네 칸 모두 평문이다 — 서비스는 원문을 가져오지 않는다. */
export type AdminNews = {
  id: number;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
};
export type NewsInput = Pick<AdminNews, "title" | "summary" | "sourceName" | "sourceUrl">;

/**
 * 방의 지금 열린 투표(HODL-111). 표 수는 담지 않는다 — 관리자도 오늘 참여하기 전에는 집계를
 * 볼 수 없고, 관리 화면이 그 정책을 돌아가는 길이 되면 안 된다.
 */
export type ActivePoll = {
  id: number;
  question: string;
  choices: { id: number; label: string }[];
};
export type PollInput = { question: string; choices: string[] };

/** 배너 한 건(HODL-92). `imageUrl` 은 서버가 준 값 그대로, `imageSrc` 는 화면에 띄울 주소다. */
export type AdminBanner = {
  id: number;
  title: string;
  imageUrl: string;
  imageSrc: string;
  altText: string;
  linkUrl: string;
  visible: boolean;
  displayOrder: number;
};
export type BannerInput = Pick<
  AdminBanner,
  "title" | "imageUrl" | "altText" | "linkUrl" | "visible"
>;
