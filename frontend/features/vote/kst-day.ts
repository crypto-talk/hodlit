/**
 * 투표의 하루는 한국 시간(Asia/Seoul) 자정에 바뀐다(HODL-64, `docs/DAILY_ROOM_POLLS_API.md`).
 *
 * 한국은 서머타임이 없어 늘 UTC+9 다. 그래서 시간대 라이브러리 없이 9시간을 더해 계산한다.
 * 브라우저 시간대와 상관없이 같은 값이 나온다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 그 순간의 한국 날짜. 서버 응답의 `day` 와 같은 `YYYY-MM-DD` 모양이다. */
export function kstDay(now: number): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 다음 한국 자정까지 남은 밀리초. 자정 정각이면 하루 뒤를 가리킨다. */
export function msUntilKstMidnight(now: number): number {
  return DAY_MS - ((((now + KST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS);
}
