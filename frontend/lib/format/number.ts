/**
 * 숫자 표기 유틸 (D-8).
 *
 * 컴포넌트가 각자 toLocaleString 을 부르면 자릿수와 로케일이 화면마다 어긋난다.
 * 표기는 전부 여기를 지난다.
 */

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

/** 원화. `₩53,000,000` */
export function formatKrw(value: number): string {
  return KRW.format(value);
}

/**
 * 코인 수량. 코인마다 의미 있는 자릿수가 달라 소수 자릿수를 받는다.
 *
 * ⚠️ 글에 붙는 보유 수량에는 쓰지 않는다. 그쪽은 지갑 특정을 막기 위해
 * `lib/holder-snapshot/` 의 구간 표기만 쓴다.
 */
export function formatQuantity(value: number, fractionDigits = 4): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** 큰 수 축약. `12,400` → `1.2만` */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 100_000_000) return `${trimZero(value / 100_000_000)}억`;
  if (abs >= 10_000) return `${trimZero(value / 10_000)}만`;
  return new Intl.NumberFormat("ko-KR").format(value);
}

/**
 * 24시간 등락률. 값이 없으면 대시를 돌려준다.
 * 부호는 항상 붙인다. `+2.4%` / `-2.4%` / `0.0%`
 */
export function formatChangeRate(change: number | null | undefined): string {
  if (change === null || change === undefined || !Number.isFinite(change)) {
    return "-";
  }
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return "0.0%";
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)}%`;
}

function trimZero(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
