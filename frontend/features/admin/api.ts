import type { components } from "@/lib/api-schema";
import { coinNameKo } from "@/lib/coin-name-ko";
import type { RoomOperationStatus } from "@/lib/room-status";
import type { AdminRoomFilter } from "@/lib/routes";
import { ApiError, http } from "@/lib/http";
import { imageSrc } from "@/lib/media";
import { kstInputToUtc, parseWeight, toDrawStatus } from "./draw-events";
import type {
  ActivePoll,
  AdminBanner,
  AdminDrawEvent,
  AdminDrawPrize,
  DrawEventInput,
  DrawPrizeInput,
  AdminNews,
  AdminRoom,
  AdminRoomPage,
  BannerInput,
  NewsInput,
  PollInput,
  BadgeConfig,
  BadgePresets,
  Category,
  ModerationLog,
  ModerationRow,
  Page,
} from "./types";

const ROOT = "/api/v1/admin";

export const loadCategories = () => http<Category[]>(`${ROOT}/room-categories`);
export const loadBadgeConfig = (symbol: string) =>
  http<BadgeConfig>(`${ROOT}/communities/${encodeURIComponent(symbol)}/badge-config`);
export const loadBadgePresets = () => http<BadgePresets>(`${ROOT}/badge-presets`);
export const saveBadgeConfig = (symbol: string, config: BadgeConfig) =>
  http<BadgeConfig>(`${ROOT}/communities/${encodeURIComponent(symbol)}/badge-config`, {
    method: "PUT",
    body: JSON.stringify({ expectedVersion: config.version, tiers: config.tiers }),
  });
export const createRoom = (body: {
  symbol: string;
  name: string;
  displayOrder: number;
  categoryId: number | null;
}) => http<AdminRoom>(`${ROOT}/communities`, { method: "POST", body: JSON.stringify(body) });
export const updateRoom = (room: AdminRoom) =>
  http<AdminRoom>(`${ROOT}/communities/${encodeURIComponent(room.symbol)}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: room.name,
      displayOrder: room.displayOrder,
      categoryId: room.categoryId,
      active: room.active,
    }),
  });
export const deleteRoom = (symbol: string) =>
  http<void>(`${ROOT}/communities/${encodeURIComponent(symbol)}`, { method: "DELETE" });
export const saveCategory = (id: number | null, name: string, displayOrder: number) =>
  http<Category>(`${ROOT}/room-categories${id === null ? "" : `/${id}`}`, {
    method: id === null ? "POST" : "PATCH",
    body: JSON.stringify({ name, displayOrder }),
  });
export const deleteCategory = (id: number) =>
  http<void>(`${ROOT}/room-categories/${id}`, { method: "DELETE" });
export const loadModeration = (
  type: "posts" | "members",
  q: string,
  state: string,
  page: number,
) => {
  const params = new URLSearchParams({ q, page: String(page), size: "20" });
  if (state) params.set("state", state);
  return http<Page<ModerationRow>>(`${ROOT}/${type}?${params}`);
};
export const loadModerationDetail = (type: "posts" | "members", id: number) =>
  http<ModerationRow>(`${ROOT}/${type}/${id}`);
export const changeModeration = (
  type: "posts" | "members",
  id: number,
  enabled: boolean,
  reason: string,
) =>
  http<ModerationRow>(`${ROOT}/${type}/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ enabled, reason }),
  });
export const loadModerationLogs = (page: number) =>
  http<Page<ModerationLog>>(`${ROOT}/moderation-logs?page=${page}&size=20`);

const ADMIN_ROOMS = `${ROOT}/communities`;
export const ADMIN_ROOM_PAGE_SIZE = 20;
type Schemas = components["schemas"];
type RoomResponse = Schemas["RoomResponse"];
type RoomPageResponse = Schemas["PageResponseRoomResponse"];
type ChangeStatusRequest = Schemas["ChangeStatusRequest"];
const STATUS_PARAM: Record<AdminRoomFilter, RoomOperationStatus> = {
  open: "OPEN",
  closed: "CLOSE",
};
/** 방 목록. `page` 는 1부터 받는다(백엔드는 0부터). */
export async function loadAdminRooms(options: {
  q?: string;
  status?: AdminRoomFilter | null;
  page?: number;
  size?: number;
}): Promise<AdminRoomPage> {
  const page = Math.max(1, options.page ?? 1);
  const query = new URLSearchParams({
    page: String(page - 1),
    size: String(options.size ?? ADMIN_ROOM_PAGE_SIZE),
  });
  const q = options.q?.trim();
  if (q) query.set("q", q.slice(0, 100));
  if (options.status) query.set("operationStatus", STATUS_PARAM[options.status]);

  const result = await http<RoomPageResponse>(`${ADMIN_ROOMS}?${query.toString()}`);
  return {
    items: (result.items ?? []).flatMap(toRoom),
    page: (result.page ?? page - 1) + 1,
    totalPages: result.totalPages ?? 0,
    totalElements: result.totalElements ?? 0,
  };
}

/**
 * 관리자 화면에 들어올 수 있는지 확인한다. 가장 가벼운 방 목록 요청을 보내고, 실패하면
 * `ApiError` 를 그대로 던진다 — 화면이 `status` 로 401 · 403 을 나눈다.
 */
export async function checkAdminAccess(): Promise<true> {
  await loadAdminRooms({ size: 1 });
  return true;
}

/** 방 열기 · 닫기. 같은 상태를 다시 보내도 괜찮다(백엔드가 멱등). */
export async function setRoomStatus(
  symbol: string,
  operationStatus: RoomOperationStatus,
): Promise<AdminRoom | null> {
  const result = await http<RoomResponse>(`${ADMIN_ROOMS}/${encodeURIComponent(symbol)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ operationStatus } satisfies ChangeStatusRequest),
  });
  return toRoom(result)[0] ?? null;
}

function toRoom(room: RoomResponse): AdminRoom[] {
  if (room.id === undefined || !room.symbol) return [];
  return [
    {
      id: room.id,
      catalogName: room.name ?? room.symbol,
      displayOrder: room.displayOrder ?? 0,
      categoryId: room.categoryId ?? null,
      symbol: room.symbol,
      name: coinNameKo(room.symbol, room.name ?? room.symbol),
      active: room.active ?? true,
      // 값이 없으면 열린 것으로 본다. 사용자 화면의 `isOpenRoom()` 과 같은 기준이다.
      operationStatus: room.operationStatus === "CLOSE" ? "CLOSE" : "OPEN",
    },
  ];
}

/** 방 고르기 칸에 넣을 방 전부. 닫힌 방도 온다 — 고르는 화면이 닫힘을 표시한다. */
export async function loadRoomChoices(): Promise<AdminRoom[]> {
  const result = await loadAdminRooms({ size: 100 });
  return result.items.filter((room) => room.active);
}

// ── 방 뉴스 (HODL-110, `docs/COMMUNITY_NEWS_API.md`) ─────────────────────────────

type NewsResponse = Schemas["NewsResponse"];
type NewsPageResponse = Schemas["PageResponseNewsResponse"];
type SaveNewsRequest = Schemas["SaveNewsRequest"];

export const ADMIN_NEWS_PAGE_SIZE = 20;

/**
 * 방의 뉴스 목록. 사용자 화면과 같은 공개 조회라, 저장한 뒤 여기 보이는 것이 곧 사용자에게
 * 보이는 것이다. `page` 는 1부터 받는다.
 */
export async function loadAdminNews(symbol: string, page: number): Promise<Page<AdminNews>> {
  const query = new URLSearchParams({
    page: String(Math.max(1, page) - 1),
    size: String(ADMIN_NEWS_PAGE_SIZE),
  });
  const result = await http<NewsPageResponse>(
    `/api/v1/communities/${encodeURIComponent(symbol)}/news?${query.toString()}`,
  );
  return {
    items: (result.items ?? []).flatMap(toNews),
    page: (result.page ?? 0) + 1,
    totalPages: result.totalPages ?? 0,
    totalElements: result.totalElements ?? 0,
  };
}

function newsBody(input: NewsInput): string {
  return JSON.stringify({
    title: input.title.trim(),
    summary: input.summary.trim(),
    sourceName: input.sourceName.trim(),
    sourceUrl: input.sourceUrl.trim(),
  } satisfies SaveNewsRequest);
}

export const createNews = (symbol: string, input: NewsInput) =>
  http<NewsResponse>(`/api/v1/communities/${encodeURIComponent(symbol)}/news`, {
    method: "POST",
    body: newsBody(input),
  });
/** 전체 교체다. 네 칸을 모두 보낸다. */
export const updateNews = (newsId: number, input: NewsInput) =>
  http<NewsResponse>(`/api/v1/news/${newsId}`, { method: "PUT", body: newsBody(input) });
export const deleteNews = (newsId: number) =>
  http<void>(`/api/v1/news/${newsId}`, { method: "DELETE" });

function toNews(raw: NewsResponse): AdminNews[] {
  if (raw.id === undefined) return [];
  return [
    {
      id: raw.id,
      title: raw.title ?? "",
      summary: raw.summary ?? "",
      sourceName: raw.sourceName ?? "",
      sourceUrl: raw.sourceUrl ?? "",
      createdAt: raw.createdAt ?? "",
      updatedAt: raw.updatedAt ?? raw.createdAt ?? "",
    },
  ];
}

// ── 방 일일 투표 (HODL-111, `docs/DAILY_ROOM_POLLS_API.md`) ──────────────────────

type PollResponse = Schemas["PollResponse"];
type CreatePollRequest = Schemas["CreatePollRequest"];

/**
 * 방의 지금 열린 투표. 없으면 null(서버는 404 로 답한다).
 *
 * 응답에 표 수가 있어도(관리자가 오늘 직접 참여한 경우) 버린다. 관리 화면은 질문과 선택지만
 * 보여 준다 — 오늘 참여하지 않은 사람에게 집계를 보이지 않는다는 정책을 여기서 돌아가지 않는다.
 */
export async function loadActivePoll(symbol: string): Promise<ActivePoll | null> {
  try {
    return toActivePoll(
      await http<PollResponse>(`/api/v1/communities/${encodeURIComponent(symbol)}/poll`),
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** 새 투표를 만든다. 그 방에 열려 있던 투표는 서버가 닫는다(참여 기록은 남는다). */
export async function createPoll(symbol: string, input: PollInput): Promise<ActivePoll | null> {
  const result = await http<PollResponse>(
    `/api/v1/communities/${encodeURIComponent(symbol)}/polls`,
    {
      method: "POST",
      body: JSON.stringify({
        question: input.question.trim(),
        choices: input.choices.map((choice) => choice.trim()),
      } satisfies CreatePollRequest),
    },
  );
  return toActivePoll(result);
}

/** 투표를 닫는다. 새 참여만 막고 기록은 지우지 않는다. */
export const closePoll = (pollId: number) =>
  http<void>(`/api/v1/polls/${pollId}/close`, { method: "POST" });

export function toActivePoll(raw: PollResponse): ActivePoll | null {
  if (raw.id === undefined || raw.active === false) return null;
  return {
    id: raw.id,
    question: raw.question ?? "",
    choices: (raw.choices ?? []).flatMap((choice) =>
      choice.id === undefined ? [] : [{ id: choice.id, label: choice.label ?? "" }],
    ),
  };
}

// ── 배너 (HODL-92, `docs/ASSIGNED_FEATURES_API.md`) ─────────────────────────────

type BannerResponse = Schemas["BannerResponse"];
type SaveBannerRequest = Schemas["SaveBannerRequest"];

const BANNERS = `${ROOT}/banners`;
const MEDIA_PREFIX = "/api/v1/media/";

/** 배너 전부. 숨긴 것도 온다. 노출 순서대로. */
export async function loadBanners(): Promise<AdminBanner[]> {
  const result = await http<BannerResponse[]>(BANNERS);
  return result.flatMap(toBanner).sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
}

function bannerBody(input: BannerInput, displayOrder: number): string {
  const linkUrl = input.linkUrl.trim();
  return JSON.stringify({
    title: input.title.trim(),
    imageUrl: input.imageUrl,
    altText: input.altText.trim(),
    // 빈 문자열은 "링크 없음"이다. 서버가 빈 값 · null 을 같게 받는다.
    linkUrl,
    visible: input.visible,
    displayOrder,
  } satisfies SaveBannerRequest);
}

export const createBanner = (input: BannerInput, displayOrder: number) =>
  http<BannerResponse>(BANNERS, { method: "POST", body: bannerBody(input, displayOrder) });
/** 고칠 수 있는 칸 전부를 다시 보낸다(전체 교체). */
export const updateBanner = (id: number, input: BannerInput, displayOrder: number) =>
  http<BannerResponse>(`${BANNERS}/${id}`, {
    method: "PATCH",
    body: bannerBody(input, displayOrder),
  });
export const deleteBanner = (id: number) => http<void>(`${BANNERS}/${id}`, { method: "DELETE" });
/** 순서 바꾸기. 지금 있는 배너 id 를 빠짐없이 한 번씩, 새 순서대로 보낸다. */
export const reorderBanners = (ids: number[]) =>
  http<BannerResponse[]>(`${BANNERS}/order`, { method: "PATCH", body: JSON.stringify({ ids }) });

/**
 * 관리자 화면의 이미지(배너 · 뽑기 상품)를 올린다. 글 이미지와 같은 `POST /media` 다. 올린 사람
 * (지금 관리자)의 파일이어야 배너 · 상품에 쓸 수 있고, 글 · 임시저장에 붙은 파일은 쓸 수 없다 —
 * 그래서 쓸 곳마다 새로 올린다.
 */
export async function uploadAdminImage(file: File): Promise<{ url: string; src: string }> {
  const form = new FormData();
  form.append("file", file);
  const stored = await http<{ url?: string }>("/api/v1/media", { method: "POST", body: form });
  if (!stored?.url?.startsWith(MEDIA_PREFIX)) {
    throw new Error("업로드는 됐지만 응답에 파일 주소가 없습니다.");
  }
  return { url: stored.url, src: imageSrc(stored.url) ?? "" };
}

function toBanner(raw: BannerResponse): AdminBanner[] {
  if (raw.id === undefined || !raw.imageUrl) return [];
  return [
    {
      id: raw.id,
      title: raw.title ?? "",
      imageUrl: raw.imageUrl,
      imageSrc: imageSrc(raw.imageUrl) ?? "",
      altText: raw.altText ?? "",
      linkUrl: raw.linkUrl ?? "",
      visible: raw.visible ?? false,
      displayOrder: raw.displayOrder ?? 0,
    },
  ];
}

// ── 뽑기 이벤트 (HODL-94 · 96, `docs/ASSIGNED_FEATURES_API.md` "Draw events") ──────

type AdminEventResponse = Schemas["AdminEvent"];
type AdminPrizeResponse = Schemas["AdminPrize"];
type AdminEventPageResponse = Schemas["PageResponseAdminEvent"];
type EventRequest = Schemas["EventRequest"];
type PrizesRequest = Schemas["PrizesRequest"];
type StatusRequest = Schemas["StatusRequest"];

const DRAW_EVENTS = `${ROOT}/draw-events`;
export const ADMIN_DRAW_PAGE_SIZE = 20;

/** 뽑기 이벤트 목록. 최근에 만든 것부터. `page` 는 1부터 받는다(백엔드는 0부터). */
export async function loadAdminDrawEvents(page: number): Promise<Page<AdminDrawEvent>> {
  const query = new URLSearchParams({
    page: String(Math.max(1, page) - 1),
    size: String(ADMIN_DRAW_PAGE_SIZE),
  });
  const result = await http<AdminEventPageResponse>(`${DRAW_EVENTS}?${query.toString()}`);
  return {
    items: (result.items ?? []).flatMap(toDrawEventList),
    page: (result.page ?? 0) + 1,
    totalPages: result.totalPages ?? 0,
    totalElements: result.totalElements ?? 0,
  };
}

/** 이벤트 하나의 전체 설정. 가중치가 들어 있다. */
export async function loadAdminDrawEvent(id: number): Promise<AdminDrawEvent> {
  return requireDrawEvent(await http<AdminEventResponse>(`${DRAW_EVENTS}/${id}`));
}

/**
 * 기본 정보 요청 본문. 입력칸의 한국 시간을 UTC 로 바꿔 보낸다. 폼이 먼저 검사하므로 여기서
 * 바뀌지 않는 값은 폼을 거치지 않은 호출이다 — 보내지 않고 멈춘다.
 */
function eventBody(input: DrawEventInput): string {
  const startsAt = kstInputToUtc(input.startsAt);
  const endsAt = kstInputToUtc(input.endsAt);
  if (!startsAt || !endsAt) throw new Error("시작 · 종료 시각을 읽을 수 없습니다.");
  return JSON.stringify({
    title: input.title.trim(),
    description: input.description,
    startsAt,
    endsAt,
  } satisfies EventRequest);
}

/** 새 이벤트. 초안(`DRAFT`)으로 만들어진다. 상품은 따로 넣는다. */
export async function createDrawEvent(input: DrawEventInput): Promise<AdminDrawEvent> {
  return requireDrawEvent(
    await http<AdminEventResponse>(DRAW_EVENTS, { method: "POST", body: eventBody(input) }),
  );
}

/** 기본 정보 수정. 시작 전 초안만 된다(아니면 409). */
export async function updateDrawEvent(id: number, input: DrawEventInput): Promise<AdminDrawEvent> {
  return requireDrawEvent(
    await http<AdminEventResponse>(`${DRAW_EVENTS}/${id}`, {
      method: "PATCH",
      body: eventBody(input),
    }),
  );
}

/** 상품 전체 교체. 지금 보이는 순서가 곧 `displayOrder` 다. 시작 전 초안만 된다. */
export async function saveDrawPrizes(
  id: number,
  prizes: DrawPrizeInput[],
): Promise<AdminDrawEvent> {
  const body: PrizesRequest = {
    prizes: prizes.map((prize, index) => {
      const weight = parseWeight(prize.weight);
      if (weight === null) throw new Error("가중치가 잘못된 상품이 있습니다.");
      return {
        name: prize.name.trim(),
        imageUrl: prize.imageUrl.trim(),
        description: prize.description,
        weight,
        displayOrder: index,
      };
    }),
  };
  return requireDrawEvent(
    await http<AdminEventResponse>(`${DRAW_EVENTS}/${id}/prizes`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );
}

/**
 * 열기 · 중지 · 다시 열기. 처음 여는 것은 시작 전 · 상품이 있을 때만, 한 번 열면 설정이 잠긴다.
 * 다시 열어도 참여 기록은 그대로다.
 */
export async function setDrawEventStatus(
  id: number,
  status: "ACTIVE" | "PAUSED",
): Promise<AdminDrawEvent> {
  return requireDrawEvent(
    await http<AdminEventResponse>(`${DRAW_EVENTS}/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status } satisfies StatusRequest),
    }),
  );
}

function requireDrawEvent(raw: AdminEventResponse): AdminDrawEvent {
  const event = toDrawEvent(raw);
  if (!event) throw new Error("이벤트 응답에 필요한 값이 없습니다.");
  return event;
}

function toDrawEventList(raw: AdminEventResponse): AdminDrawEvent[] {
  const event = toDrawEvent(raw);
  return event ? [event] : [];
}

/** 생성 타입은 전부 선택이라 여기서 좁힌다. id 가 없는 이벤트는 다룰 수 없어 버린다. */
function toDrawEvent(raw: AdminEventResponse): AdminDrawEvent | null {
  if (typeof raw.id !== "number") return null;
  return {
    id: raw.id,
    title: raw.title ?? "",
    description: raw.description ?? "",
    startsAt: raw.startsAt ?? "",
    endsAt: raw.endsAt ?? "",
    status: toDrawStatus(raw.status),
    prizes: [...(raw.prizes ?? [])]
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .flatMap(toDrawPrize),
  };
}

function toDrawPrize(raw: AdminPrizeResponse): AdminDrawPrize[] {
  if (typeof raw.id !== "number") return [];
  return [
    {
      id: raw.id,
      name: raw.name ?? "",
      imageUrl: raw.imageUrl ?? "",
      imageSrc: imageSrc(raw.imageUrl) ?? "",
      description: raw.description ?? "",
      weight: raw.weight ?? 0,
      displayOrder: raw.displayOrder ?? 0,
    },
  ];
}
