import { safeSymbol } from "@/lib/routes";

/**
 * 이용 기록 이벤트 명세 (HODL-89). 순수 함수만 둔다 — SDK 는 `client.ts` 에만 있다.
 *
 * 프론트가 보내는 것은 **화면이 실제로 보인 순간** 셋뿐이다. 가입 · 지갑 연결 · 인증 · 글 · 댓글 같은
 * "성공한 작업"은 서버가 DB 커밋 뒤에 보낸다. 같은 성공 이벤트를 프론트에서 또 보내지 않는다.
 *
 * 보내는 속성은 여기 적힌 것이 전부다. 주소(URL) · 닉네임 · 지갑 주소 · 글 내용 · 검색어는 보내지 않는다.
 * 이벤트를 늘릴 때는 이 파일의 `AnalyticsEvent` 와 `eventProperties` 를 같이 고친다.
 */

/** 속성 모양이 바뀌면 올린다. 대시보드가 옛 이벤트와 새 이벤트를 가를 수 있게 한다. */
export const SCHEMA_VERSION = 1;

/** 어디서 왔는지. 주소 전체 대신 화면 종류만 보낸다. `direct` 는 사이트에 처음 들어온 화면이다. */
export const SOURCES = [
  "direct",
  "home",
  "room",
  "post",
  "search",
  "profile",
  "mypage",
  "write",
  "admin",
  "other",
] as const;
export type Source = (typeof SOURCES)[number];

export type AnalyticsEvent =
  /** 운영 중인 방 화면이 정상으로 보였다. */
  | { name: "room_viewed"; roomSymbol: string; source: Source }
  /** 글 상세 내용이 정상으로 보였다. */
  | { name: "post_viewed"; postId: number; roomSymbol: string; source: Source }
  /** 닫힌 방(공사 중) 안내가 보였다. */
  | { name: "room_closed_shown"; roomSymbol: string; source: Source };

export type EventProperties = Record<string, string | number>;

/**
 * 이벤트를 보낼 속성으로. 값이 명세에 안 맞으면(방 기호 모양이 아님, 글 번호가 양의 정수가 아님 등)
 * null 이고 그 이벤트는 보내지 않는다. 임의 객체를 그대로 싣지 않으려고 키를 하나씩 적는다.
 */
export function eventProperties(event: AnalyticsEvent): EventProperties | null {
  const symbol = safeSymbol(event.roomSymbol);
  if (!symbol || !SOURCES.includes(event.source)) return null;
  const base = { room_symbol: symbol, source: event.source };

  switch (event.name) {
    case "room_viewed":
    case "room_closed_shown":
      return base;
    case "post_viewed":
      if (!Number.isSafeInteger(event.postId) || event.postId <= 0) return null;
      return { post_id: event.postId, ...base };
    default:
      return null;
  }
}

/** 같은 화면을 두 번 세지 않으려고 쓰는 키. 속성이 같으면 같은 키다. */
export function eventKey(event: AnalyticsEvent): string {
  const postId = event.name === "post_viewed" ? event.postId : "";
  return `${event.name}|${event.roomSymbol}|${postId}`;
}

/** 사이트 안 경로를 화면 종류로. 쿼리 · 해시는 보지 않는다. 처음 들어온 화면이면(null) `direct`. */
export function sourceOf(path: string | null): Source {
  if (path === null) return "direct";
  const [first, second, third, fourth] = path.split(/[?#]/)[0].split("/").filter(Boolean);
  if (!first) return "home";
  if (first === "subhodl") {
    if (!second) return "other";
    // `/subhodl/ETH/12` 는 글, `/subhodl/ETH/12/edit` 는 글 수정, 그 밖(`news` · `polls`)은 방의 하위 화면이다.
    if (third && /^\d+$/.test(third)) return fourth === "edit" ? "write" : "post";
    return "room";
  }
  if (first === "search") return "search";
  if (first === "user" || first.startsWith("@") || first.startsWith("%40")) return "profile";
  if (first === "mypage") return "mypage";
  if (first === "write") return "write";
  if (first === "admin") return "admin";
  return "other";
}

/** SDK 가 스스로 붙이는 속성 가운데 주소 · 유입 경로 · 문서 제목에 해당하는 이름. 통째로 지운다. */
const URL_LIKE = /url|referr|pathname|host|title|initial|utm_|campaign|clid|search/i;

/** SDK 가 내부에서 만드는 이벤트 중 그대로 보내는 것. 식별 연결에 필요하다. */
const SDK_EVENTS = new Set(["$identify"]);
const OWN_EVENTS = new Set<string>(["room_viewed", "post_viewed", "room_closed_shown"]);

type Outgoing = {
  uuid?: string;
  event: string;
  properties: Record<string, unknown>;
  $set?: unknown;
  $set_once?: unknown;
};

/**
 * 전송 직전 마지막 거름망(`before_send`). 명세에 없는 이벤트는 버리고, 남는 이벤트에서도
 * 주소 계열 자동 속성과 사람 속성(`$set` · `$set_once` — 처음 들어온 주소 · 유입 경로가 실린다)을 지운다.
 *
 * `event_id` 를 PostHog 의 중복 제거 식별자(`uuid`)로 옮긴다. 속성에 UUID 를 넣는 것만으로는
 * 중복 제거가 되지 않는다.
 */
export function scrub<T extends Outgoing>(outgoing: T | null): T | null {
  if (!outgoing) return null;
  if (!OWN_EVENTS.has(outgoing.event) && !SDK_EVENTS.has(outgoing.event)) return null;

  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(outgoing.properties ?? {})) {
    if (URL_LIKE.test(key)) continue;
    if (key === "$set" || key === "$set_once") continue;
    properties[key] = value;
  }

  const next = { ...outgoing, properties };
  delete next.$set;
  delete next.$set_once;
  if (typeof properties.event_id === "string") next.uuid = properties.event_id;
  return next;
}
