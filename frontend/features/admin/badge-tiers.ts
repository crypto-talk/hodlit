import type { BadgeTier } from "./types";

/**
 * 등급 설정 입력 검사와 구간 문구 (HODL-83). 규칙은 백엔드와 같다(`docs/ASSIGNED_FEATURES_API.md`):
 *
 * - 첫 등급의 최소 수량은 0. 0보다 많이 가진 사람부터 등급을 받는다
 * - 다음 등급부터는 앞 등급보다 커야 한다(같아도 안 된다)
 * - 한 등급의 위쪽 끝은 다음 등급의 최소 수량이고, 마지막 등급은 위쪽 끝이 없다
 * - 수량은 정수 18자리 + 소수 18자리까지, 등급은 20개까지
 *
 * ⚠️ 수량을 `Number` 로 바꾸지 않는다. 소수 18자리는 부동소수로 못 담는다. 문자열 그대로 견주고
 * 문자열 그대로 서버에 보낸다. 서버도 같은 검사를 다시 한다 — 여기는 저장 전에 알려 주는 용도다.
 */

export const TIER_MAX = 20;
export const TIER_NAME_MAX = 40;

const DECIMAL = /^\d{1,18}(\.\d{1,18})?$/;

/** 입력칸의 값(서버는 숫자로도 줄 수 있다)을 견줄 수 있는 문자열로. 모양이 아니면 null. */
export function decimalOf(value: string | number): string | null {
  const text = String(value).trim();
  return DECIMAL.test(text) ? text : null;
}

/** 앞뒤 0 을 걷어낸다. `"01.50"` → `"1.5"`, `"0.0"` → `"0"`. 서버의 `stripTrailingZeros` 와 같은 모양. */
export function plainDecimal(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const head = whole.replace(/^0+(?=\d)/, "");
  const tail = fraction.replace(/0+$/, "");
  return tail ? `${head}.${tail}` : head;
}

/** 모양이 맞는 두 수를 견준다. a < b 면 음수. */
export function compareDecimal(a: string, b: string): number {
  const [aWhole, aFraction = ""] = plainDecimal(a).split(".");
  const [bWhole, bFraction = ""] = plainDecimal(b).split(".");
  if (aWhole.length !== bWhole.length) return aWhole.length - bWhole.length;
  if (aWhole !== bWhole) return aWhole < bWhole ? -1 : 1;
  const width = Math.max(aFraction.length, bFraction.length);
  const left = aFraction.padEnd(width, "0");
  const right = bFraction.padEnd(width, "0");
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** 등급마다의 문제. 문제가 없으면 그 자리는 null. */
export function tierProblems(tiers: BadgeTier[]): (string | null)[] {
  return tiers.map((tier, index) => {
    if (!tier.name.trim()) return "이름을 적어 주세요.";
    if (tier.name.trim().length > TIER_NAME_MAX) return `이름은 ${TIER_NAME_MAX}자까지입니다.`;

    const minimum = decimalOf(tier.minimumQuantity);
    if (minimum === null) return "최소 수량은 숫자로 적어 주세요. 소수는 18자리까지입니다.";

    if (index === 0) {
      return compareDecimal(minimum, "0") === 0 ? null : "첫 등급의 최소 수량은 0이어야 합니다.";
    }

    const previous = decimalOf(tiers[index - 1].minimumQuantity);
    // 앞 등급이 잘못됐으면 그쪽에서 이미 안내한다. 여기서 한 번 더 말하지 않는다.
    if (previous === null) return null;
    const order = compareDecimal(minimum, previous);
    if (order === 0) return "앞 등급과 최소 수량이 같습니다. 구간이 겹칩니다.";
    if (order < 0) return "앞 등급보다 최소 수량이 작습니다. 작은 수량부터 차례로 적어 주세요.";
    return null;
  });
}

/** 저장을 막을 문제 한 줄. 없으면 null. */
export function configProblem(tiers: BadgeTier[]): string | null {
  if (tiers.length === 0) return "등급이 하나는 있어야 합니다.";
  if (tiers.length > TIER_MAX) return `등급은 ${TIER_MAX}개까지입니다.`;
  return tierProblems(tiers).some(Boolean) ? "빨간 안내가 있는 등급을 고쳐 주세요." : null;
}

/**
 * 글 · 댓글에 찍힐 구간 문구. 서버가 찍는 모양과 같다: `0.1~1 ETH`, 마지막 등급은 `100+ ETH`.
 * 미리보기용이다 — 실제 문구는 발행할 때 서버가 만든다.
 */
export function bandPreview(tiers: BadgeTier[], index: number, symbol: string): string {
  const lower = decimalOf(tiers[index].minimumQuantity);
  if (lower === null) return `? ${symbol}`;
  const next = index + 1 < tiers.length ? decimalOf(tiers[index + 1].minimumQuantity) : null;
  if (index + 1 === tiers.length) return `${plainDecimal(lower)}+ ${symbol}`;
  return `${plainDecimal(lower)}~${next === null ? "?" : plainDecimal(next)} ${symbol}`;
}

/** 구간을 말로 푼 것. `0 초과 0.1 미만`, `0.1 이상 1 미만`, `100 이상`. */
export function rangeText(tiers: BadgeTier[], index: number): string {
  const lower = decimalOf(tiers[index].minimumQuantity);
  if (lower === null) return "구간을 알 수 없습니다";
  const from = compareDecimal(lower, "0") === 0 ? "0 초과" : `${plainDecimal(lower)} 이상`;
  if (index + 1 === tiers.length) return `${from} (위쪽 끝 없음)`;
  const next = decimalOf(tiers[index + 1].minimumQuantity);
  return `${from} ${next === null ? "?" : plainDecimal(next)} 미만`;
}

/** 저장된 설정과 달라졌는지. 수량은 `1` 과 `1.0` 을 같게 본다. */
export function sameTiers(a: BadgeTier[], b: BadgeTier[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((tier, index) => {
    const other = b[index];
    const left = decimalOf(tier.minimumQuantity);
    const right = decimalOf(other.minimumQuantity);
    const sameMinimum =
      left !== null && right !== null
        ? compareDecimal(left, right) === 0
        : String(tier.minimumQuantity) === String(other.minimumQuantity);
    return (
      tier.name === other.name &&
      sameMinimum &&
      tier.icon === other.icon &&
      tier.color === other.color &&
      tier.effect === other.effect
    );
  });
}
