import { tierLabel } from "@/lib/holder-snapshot/label";
import type { Tier } from "@/lib/holder-snapshot/types";

type BadgeStyle = {
  bg: string;
  color: string;
  border: string;
};

/**
 * 인증 등급 배지. 지갑연결 / 거래소연동 / 미인증 3단계.
 *
 * 문구는 `lib/holder-snapshot/label.ts` 에서 가져온다(구조 규칙 3). 여기는 모양만 정한다.
 * 랜딩·글 상세·게시판이 같이 쓰므로 `components/` 에 있다.
 *
 * 색은 tokens.css 의 배지 토큰을 가리킨다. 배지만 따로 색을 가야 하면 거기를
 * 고친다 — 여기에 값을 적지 않는다.
 */
const BADGE: Record<Tier, BadgeStyle> = {
  wallet: {
    bg: "var(--badge-wallet-bg)",
    color: "var(--badge-wallet-text)",
    border: "transparent",
  },
  exchange: {
    bg: "var(--badge-exchange-bg)",
    color: "var(--badge-exchange-text)",
    border: "transparent",
  },
  none: {
    bg: "transparent",
    color: "var(--badge-none-text)",
    border: "var(--badge-none-border)",
  },
};

export default function TierBadge({ tier }: { tier: Tier }) {
  const style = BADGE[tier];
  return (
    <span
      className="flex-none rounded-sm border border-transparent px-2 py-0.5 text-xs font-semibold"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {tierLabel(tier)}
    </span>
  );
}
