import type { Problems } from "./limits";
import type {
  AdminDrawEvent,
  AdminDrawPrize,
  DrawEventInput,
  DrawEventStatus,
  DrawPrizeInput,
} from "./types";

/**
 * 관리자 뽑기 이벤트 관리의 순수 함수 (HODL-94 · 96).
 *
 * 화면이 쓰는 상태 이름 · 한국 시간 ↔ UTC 변환 · 당첨 확률 · 입력 검사를 모았다. 규칙은 백엔드
 * `DrawService.java` 를 그대로 옮긴 것이고, 서버가 같은 검사를 다시 한다 — 여기는 보내기 전에
 * 어느 칸이 문제인지 알려 주는 용도다.
 */

// ── 상태 ─────────────────────────────────────────────────────────────────────

/**
 * 관리 화면이 보여 줄 상태. 서버 상태값(`DRAFT` · `ACTIVE` · `PAUSED`)과 기간을 함께 본다.
 *
 * - `draft`     초안. 고칠 수 있고 열 수 있다
 * - `expired`   시작 시각이 지난 초안. 서버가 수정도 첫 열기도 막는다
 * - `scheduled` 열었지만 아직 시작 전. 참여 화면은 "시작 전" 이다
 * - `live`      진행 중
 * - `paused`    중지. 종료 전까지 다시 열 수 있다
 * - `ended`     종료. 다시 열 수 없다
 * - `unknown`   서버가 모르는 상태값을 보냈다
 *
 * 참여 화면(`features/draw/phase.ts`)의 before · ended · paused 와 같은 기준이다.
 */
export type AdminDrawPhase =
  "draft" | "expired" | "scheduled" | "live" | "paused" | "ended" | "unknown";

export const PHASE_LABEL: Record<AdminDrawPhase, string> = {
  draft: "초안",
  expired: "기한 지난 초안",
  scheduled: "시작 전 (열림)",
  live: "진행 중",
  paused: "중지",
  ended: "종료",
  unknown: "알 수 없음",
};

export function adminDrawPhase(
  event: Pick<AdminDrawEvent, "status" | "startsAt" | "endsAt">,
  now: number,
): AdminDrawPhase {
  const starts = Date.parse(event.startsAt);
  const ends = Date.parse(event.endsAt);
  const beforeStart = Number.isFinite(starts) && now < starts;
  const afterEnd = Number.isFinite(ends) && now >= ends;

  if (event.status === "DRAFT") return beforeStart ? "draft" : "expired";
  if (event.status === null) return "unknown";
  // 한 번 연 이벤트는 기간이 끝나면 상태값과 상관없이 종료다. 서버도 다시 열기를 막는다.
  if (afterEnd) return "ended";
  if (event.status === "PAUSED") return "paused";
  return beforeStart ? "scheduled" : "live";
}

/** 서버 응답의 상태 문자열을 좁힌다. 모르는 값은 null. */
export function toDrawStatus(value: string | undefined): DrawEventStatus | null {
  return value === "DRAFT" || value === "ACTIVE" || value === "PAUSED" ? value : null;
}

/** 기본 정보 · 상품을 고칠 수 있는지. 시작 전 초안만 된다(서버 `requireEditable`). */
export function isEditable(phase: AdminDrawPhase): boolean {
  return phase === "draft";
}

/** 고칠 수 없을 때 그 이유 한 줄. 고칠 수 있으면 null. */
export function lockReason(phase: AdminDrawPhase): string | null {
  switch (phase) {
    case "draft":
      return null;
    case "expired":
      return "시작 시각이 지난 초안이라 고칠 수도, 열 수도 없습니다. 새 이벤트를 만들어 주세요.";
    case "unknown":
      return "서버가 알 수 없는 상태를 보내 고칠 수 없게 막았습니다.";
    default:
      return "한 번 연 이벤트라 기본 정보와 상품을 고칠 수 없습니다.";
  }
}

/** 지금 누를 수 있는 상태 버튼. 없으면 null. */
export type DrawStatusAction = "open" | "pause" | "resume";

export function statusAction(phase: AdminDrawPhase): DrawStatusAction | null {
  if (phase === "draft") return "open";
  if (phase === "scheduled" || phase === "live") return "pause";
  if (phase === "paused") return "resume";
  return null;
}

// ── 한국 시간 ↔ UTC ───────────────────────────────────────────────────────────

/** 한국은 일광 절약 시간이 없어 언제나 UTC+9 다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * `datetime-local` 값(한국 시간)을 UTC ISO-8601 로. 모양이 아니거나 없는 날짜(2월 30일)면 null.
 *
 * 브라우저 시간대로 읽지 않는다 — 관리자가 해외에 있어도 입력칸의 숫자는 한국 시간이다.
 */
export function kstInputToUtc(value: string): string | null {
  const match = INPUT_PATTERN.exec(value.trim());
  if (!match) return null;
  // 초 칸은 없을 수 있다(`step` 을 주지 않은 입력칸). 없으면 0 초다.
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  const ms = Date.UTC(year, month - 1, day, hour, minute, second) - KST_OFFSET_MS;
  if (!Number.isFinite(ms)) return null;
  const iso = new Date(ms).toISOString();
  // `Date.UTC` 는 2월 30일을 3월 2일로 넘겨 버린다. 되돌려 같은 값이 아니면 없는 날짜다.
  return utcToKstInput(iso).slice(0, 16) === value.trim().slice(0, 16) ? iso : null;
}

/** UTC ISO-8601 을 `datetime-local` 값(한국 시간, 분까지)으로. 읽을 수 없으면 빈 문자열. */
export function utcToKstInput(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16);
}

const KST_FORMAT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 한국 시간으로 `2026. 11. 20. 10:00`. 입력칸과 같은 기준으로 보이게 브라우저 시간대를 쓰지 않는다. */
export function formatKst(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? KST_FORMAT.format(ms) : "";
}

// ── 당첨 확률 ─────────────────────────────────────────────────────────────────

/**
 * 가중치 칸의 글자를 숫자로. 양의 정수가 아니면 null.
 *
 * 서버는 64비트 정수까지 받지만 여기서는 JavaScript 가 정확히 셀 수 있는 수
 * (`Number.MAX_SAFE_INTEGER`)까지만 받는다. 그보다 크면 응답의 가중치가 반올림되어 화면과 서버가
 * 어긋난다.
 */
export function parseWeight(text: string): number | null {
  const value = text.trim();
  if (!/^[1-9]\d*$/.test(value)) return null;
  const weight = Number(value);
  return Number.isSafeInteger(weight) ? weight : null;
}

/**
 * 상품마다의 당첨 확률(%). 확률 = 가중치 / 가중치 합(서버와 같다).
 * 가중치가 잘못된 줄은 null 이고, 그 줄은 합에서도 뺀다 — 고치는 동안 나머지 줄의 값이 보이게.
 */
export function prizeOdds(weights: (number | null)[]): (number | null)[] {
  const total = weights.reduce<number>((sum, weight) => sum + (weight ?? 0), 0);
  return weights.map((weight) => (weight === null || total <= 0 ? null : (weight / total) * 100));
}

const ODDS_FORMAT = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });

/** `12.5%`. 0.01% 보다 작으면 0 으로 보이지 않게 `0.01% 미만` 이라고 적는다. */
export function formatOdds(percent: number | null): string {
  if (percent === null) return "—";
  if (percent > 0 && percent < 0.01) return "0.01% 미만";
  return `${ODDS_FORMAT.format(percent)}%`;
}

// ── 입력 검사 ─────────────────────────────────────────────────────────────────

export const DRAW_EVENT_MAX = { title: 100, description: 2000 } as const;
export const DRAW_PRIZE_MAX = { count: 100, name: 100, description: 1000, imageUrl: 1000 } as const;
const MEDIA_PREFIX = "/api/v1/media/";

/** 이벤트 기본 정보의 칸별 문제. `now` 는 지금 시각(ms) — 시작은 지금보다 뒤여야 한다. */
export function drawEventProblems(input: DrawEventInput, now: number): Problems<DrawEventInput> {
  const problems: Problems<DrawEventInput> = {};
  const title = input.title.trim();
  if (!title) problems.title = "제목을 적어 주세요.";
  else if (title.length > DRAW_EVENT_MAX.title) {
    problems.title = `제목은 ${DRAW_EVENT_MAX.title}자까지입니다. 지금 ${title.length}자입니다.`;
  }
  if (input.description.length > DRAW_EVENT_MAX.description) {
    problems.description = `설명은 ${DRAW_EVENT_MAX.description}자까지입니다. 지금 ${input.description.length}자입니다.`;
  }

  const starts = kstInputToUtc(input.startsAt);
  const ends = kstInputToUtc(input.endsAt);
  if (!input.startsAt) problems.startsAt = "시작 시각을 골라 주세요.";
  else if (!starts) problems.startsAt = "시작 시각을 읽을 수 없습니다.";
  else if (Date.parse(starts) <= now) problems.startsAt = "시작 시각은 지금보다 뒤여야 합니다.";

  if (!input.endsAt) problems.endsAt = "종료 시각을 골라 주세요.";
  else if (!ends) problems.endsAt = "종료 시각을 읽을 수 없습니다.";
  else if (starts && Date.parse(ends) <= Date.parse(starts)) {
    problems.endsAt = "종료 시각은 시작 시각보다 뒤여야 합니다.";
  }
  return problems;
}

/** 상품 이미지 주소로 받아들일 모양: 직접 올린 파일(`/api/v1/media/…`) 또는 https 주소. */
export function isPrizeImageUrl(value: string): boolean {
  if (value.startsWith(MEDIA_PREFIX)) return true;
  try {
    const url = new URL(value);
    // 서버는 https 만 받고, 사용자 정보가 붙은 주소(`https://a:b@…`)는 거절한다.
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export type PrizeProblems = {
  /** 목록 전체의 문제(개수 · 가중치 합). */
  list: string | null;
  /** 줄 번호 → 그 줄의 문제. */
  rows: Record<number, string>;
};

/** 상품 목록 검사. 서버는 이름을 앞뒤 공백을 자른 뒤 대소문자를 가려 같은 이름을 거절한다. */
export function prizeProblems(prizes: DrawPrizeInput[]): PrizeProblems {
  const rows: Record<number, string> = {};
  const seen = new Set<string>();
  let total = 0;

  prizes.forEach((prize, index) => {
    const name = prize.name.trim();
    const weight = parseWeight(prize.weight);
    let problem: string | null = null;
    if (!name) problem = "이름을 적어 주세요.";
    else if (name.length > DRAW_PRIZE_MAX.name) {
      problem = `이름은 ${DRAW_PRIZE_MAX.name}자까지입니다.`;
    } else if (seen.has(name)) problem = "앞의 상품과 이름이 같습니다.";
    else if (prize.description.length > DRAW_PRIZE_MAX.description) {
      problem = `설명은 ${DRAW_PRIZE_MAX.description}자까지입니다.`;
    } else if (!prize.imageUrl) problem = "이미지를 올리거나 https 주소를 적어 주세요.";
    else if (prize.imageUrl.length > DRAW_PRIZE_MAX.imageUrl || !isPrizeImageUrl(prize.imageUrl)) {
      problem = "이미지는 직접 올린 파일이나 https:// 로 시작하는 주소만 됩니다.";
    } else if (weight === null) problem = "가중치는 1 이상의 정수입니다.";
    if (name) seen.add(name);
    if (problem) rows[index] = problem;
    total += weight ?? 0;
  });

  let list: string | null = null;
  if (prizes.length === 0) list = "상품을 하나 이상 넣어 주세요.";
  else if (prizes.length > DRAW_PRIZE_MAX.count) {
    list = `상품은 ${DRAW_PRIZE_MAX.count}개까지입니다.`;
  } else if (!Number.isSafeInteger(total)) list = "가중치 합이 너무 큽니다. 값을 줄여 주세요.";
  return { list, rows };
}

/** 저장된 상품을 편집 칸 값으로. */
export function toPrizeInputs(prizes: AdminDrawPrize[]): DrawPrizeInput[] {
  return prizes.map((prize) => ({
    key: `saved-${prize.id}`,
    name: prize.name,
    description: prize.description,
    imageUrl: prize.imageUrl,
    weight: String(prize.weight),
  }));
}

/** 편집 중인 상품이 저장된 것과 같은지. 순서도 본다. `key` 는 화면용이라 보지 않는다. */
export function samePrizes(a: DrawPrizeInput[], b: DrawPrizeInput[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (prize, index) =>
        prize.name === b[index].name &&
        prize.description === b[index].description &&
        prize.imageUrl === b[index].imageUrl &&
        prize.weight.trim() === b[index].weight.trim(),
    )
  );
}

/** 저장된 이벤트를 기본 정보 폼 값으로. */
export function toEventInput(event: AdminDrawEvent): DrawEventInput {
  return {
    title: event.title,
    description: event.description,
    startsAt: utcToKstInput(event.startsAt),
    endsAt: utcToKstInput(event.endsAt),
  };
}
