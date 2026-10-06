import type { HolderSnapshot, Tier } from "./types";

/**
 * 보유 정보를 화면 문구로 바꾸는 단일 지점 (구조 규칙 3).
 *
 * 화면 요소가 없는 순수 함수 모음이라 `lib/` 에 있다. 예전 이름은
 * `features/badge` 였는데, 랜딩·글 상세·게시판·프로필이 모두 써야 해서
 * features 끼리 참조 금지(구조 규칙 1)와 계속 부딪혔다.
 *
 * ⚠️ 이 규칙들은 지갑 특정 방지 장치다. 정확한 수량이나 매수 시각이 드러나면
 * 온체인에서 지갑 주인을 역추적할 수 있다. 화면마다 각자 만들면 한 군데서 새는
 * 순간 전체가 무너지므로 여기 밖에서 만들지 않는다.
 *
 * ⚠️ 수량 구간은 **서버가 계산한다.** `quantityBand` 를 그대로 쓰고 프론트에서
 * 다시 계산하지 않는다. 두 곳에서 계산하면 기준이 어긋나 같은 글이 화면마다
 * 다른 구간으로 보인다(실제로 한 번 어긋난 적이 있다). 구간 기준을 바꾸려면
 * 백엔드 `PostHolderSnapshot.band()` 를 고쳐야 한다.
 */

export const UNKNOWN_HOLDING_LABEL = "보유 기간 미확인";

const TIER_LABEL: Record<Tier, string> = {
  wallet: "지갑연결",
  exchange: "거래소연동",
  none: "미인증",
};

const VERIFICATION_LABEL: Record<string, string> = {
  WALLET: TIER_LABEL.wallet,
  UNVERIFIED: TIER_LABEL.none,
};

/**
 * 서버 값 → 인증 등급. 모르는 값이면 가장 약한 등급으로 떨어뜨린다.
 * 거래소 연동 등급은 백엔드에 아직 없다. WALLET 아니면 전부 미인증이다.
 */
export function tierOf(
  verificationLevel: string | null | undefined,
  verifiedHolder: boolean | null | undefined,
): Tier {
  if (verificationLevel === "WALLET") return "wallet";
  return verifiedHolder ? "wallet" : "none";
}

/** 인증 등급 배지 문구. */
export function tierLabel(tier: Tier): string {
  return TIER_LABEL[tier];
}

/** 인증 등급 배지 문구. 모르는 값이 오면 가장 약한 등급으로 떨어뜨린다. */
export function verificationLabel(snapshot: HolderSnapshot): string {
  return VERIFICATION_LABEL[snapshot.verificationLevel] ?? VERIFICATION_LABEL.UNVERIFIED;
}

/**
 * 보유 수량 문구. 서버가 준 구간을 그대로 돌려준다.
 *
 * 미인증이면 null 이다. 빈 문자열이 아니라 null 인 이유는, 자리를 비울지
 * 말지를 호출하는 쪽이 정하게 하려는 것이다.
 */
export function amountLabel(snapshot: HolderSnapshot): string | null {
  return snapshot.quantityBand;
}

/**
 * 보유 기간 문구. 월 단위로만 나가고 일·시각은 어떤 경로로도 표기하지 않는다.
 *
 * 서버의 `holdingMonths` 는 `ChronoUnit.MONTHS.between` 으로 내린 값이다.
 * 여기서 다시 반올림하면 실제보다 긴 기간이 표시되어 매수 시점을 한 달 앞으로
 * 추정할 여지를 준다. 그래서 받은 값을 그대로 쓴다.
 *
 * - null → `보유 기간 미확인` (인덱서 전까지 항상 이쪽, G-6)
 * - 0    → `1개월 미만 보유`
 * - 8    → `8개월 보유`
 * - 12   → `1년 보유`
 * - 27   → `2년 3개월 보유`
 */
export function holdingLabel(snapshot: HolderSnapshot): string {
  return holdingPeriodLabel(snapshot.holdingMonths);
}

export function holdingPeriodLabel(holdingMonths: number | null | undefined): string {
  if (holdingMonths === null || holdingMonths === undefined) return UNKNOWN_HOLDING_LABEL;
  if (!Number.isFinite(holdingMonths) || holdingMonths < 0) return UNKNOWN_HOLDING_LABEL;

  const months = Math.floor(holdingMonths);
  if (months < 1) return "1개월 미만 보유";
  if (months < 12) return `${months}개월 보유`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years}년 보유` : `${years}년 ${rest}개월 보유`;
}
