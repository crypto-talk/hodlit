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

/**
 * 뽑기 이벤트의 서버 상태(HODL-94 · 96, `DrawEvent.java`). 만들면 `DRAFT`, 처음 열면 `ACTIVE`,
 * 그 뒤로는 `ACTIVE` ↔ `PAUSED` 만 오간다. 종료는 상태값이 아니라 `endsAt` 으로 정해진다.
 * 모르는 값이 오면 null 로 둔다 — 그럴듯한 상태로 바꿔 버튼을 보이지 않으려는 것이다.
 */
export type DrawEventStatus = "DRAFT" | "ACTIVE" | "PAUSED";

/** 뽑기 상품 한 개(관리자용). 가중치가 들어 있다 — 공개 조회에는 없는 값이다. */
export type AdminDrawPrize = {
  id: number;
  name: string;
  /** 서버가 준 값 그대로. 저장할 때 이 값을 다시 보낸다. */
  imageUrl: string;
  /** 화면에 띄울 주소. 쓸 수 없는 모양이면 빈 문자열. */
  imageSrc: string;
  description: string;
  weight: number;
  displayOrder: number;
};

/** 뽑기 이벤트 한 건(관리자용). 시각은 UTC ISO-8601 그대로다. */
export type AdminDrawEvent = {
  id: number;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: DrawEventStatus | null;
  prizes: AdminDrawPrize[];
};

/**
 * 이벤트 만들기 · 고치기 폼의 값. 시각은 `<input type="datetime-local">` 의 값(`2026-11-20T10:00`)을
 * **한국 시간으로** 읽은 것이다. 보낼 때 UTC 로 바꾼다(`kstInputToUtc`).
 */
export type DrawEventInput = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
};

/**
 * 상품 편집 칸 한 줄. 가중치는 입력 중인 글자 그대로(빈 칸 · 잘못된 값도 담긴다).
 * `key` 는 줄을 옮기거나 지울 때 React 가 줄을 헷갈리지 않게 하는 화면용 값이다.
 */
export type DrawPrizeInput = {
  key: string;
  name: string;
  description: string;
  imageUrl: string;
  weight: string;
};
