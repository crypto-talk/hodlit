/**
 * 시각 표기 유틸 (D-8 연장).
 *
 * 백엔드는 `Instant` 를 ISO-8601 UTC(`2026-09-19T06:30:00Z`)로 준다. `Date` 가
 * 그대로 파싱한다. 타임존이 빠진 문자열이 오면 브라우저 로컬로 해석되어 9시간
 * 어긋나므로, 시간이 이상하면 응답 형식부터 확인한다.
 */

const SAME_YEAR = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
const OTHER_YEAR = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const DATE = new Intl.DateTimeFormat("ko-KR");

const CLOCK = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 시각만. `18:02` 시세처럼 오늘 안에서 계속 바뀌는 값의 기준 시각에 쓴다. */
export function formatClock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "";
  return CLOCK.format(new Date(ms));
}

/** 날짜. `2026. 9. 19.` 상대 시각이 어색한 기록성 표기에 쓴다. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";

  return DATE.format(at);
}

/**
 * 상대 시각. 일주일이 넘으면 날짜로 떨어진다.
 *
 * `now` 를 인자로 받는 이유는 테스트 때문이다. 화면에서는 넘기지 않는다.
 */
export function formatRelativeTime(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return "";

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";

  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);

  // 서버와 브라우저 시계가 몇 초 어긋나면 음수가 나온다. 미래로 보이지 않게 막는다.
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;

  return at.getFullYear() === now.getFullYear() ? SAME_YEAR.format(at) : OTHER_YEAR.format(at);
}
