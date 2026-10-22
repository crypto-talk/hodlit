/** 조각 색. 칸 번호대로 `--chart-1..5`, 기타는 회색. 색 값은 `styles/tokens.css` 에 있다. */
export function sliceColor(slot: number | null): string {
  return slot === null ? "var(--chart-other)" : `var(--chart-${slot + 1})`;
}
