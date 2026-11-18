/** `2026-10-23` → `10월 23일`. 서버가 준 한국 날짜 문자열을 그대로 읽는다(시간대 변환 없음). */
export function formatKstDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return month && date ? `${month}월 ${date}일` : day;
}

/** `2026-10-23` → `2026년 10월 23일`. 지난 기록처럼 해가 넘어갈 수 있는 목록에 쓴다. */
export function formatKstDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return year && month && date ? `${year}년 ${month}월 ${date}일` : day;
}
