import { tierLabel } from "@/lib/holder-snapshot/label";
import type { Tier } from "@/lib/holder-snapshot/types";

type BadgeStyle = {
  bg: string;
  color: string;
  border: string;
};

/**
 * 보유 표기 배지. 지갑연결 / 거래소연동 / 미보유 / 미인증.
 *
 * 미보유와 미인증은 같은 모양이다. 연결하지 않은 사람보다 연결한 정직한 사람이 더
 * 눈에 띄면 지갑을 연결할 이유가 없어진다. 사실만 같은 무게로 보여준다.
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
  empty: {
    bg: "transparent",
    color: "var(--badge-none-text)",
    border: "var(--badge-none-border)",
  },
  none: {
    bg: "transparent",
    color: "var(--badge-none-text)",
    border: "var(--badge-none-border)",
  },
};

type Props = {
  tier: Tier;
  /** 미보유일 때 `ETH 미보유` 처럼 붙일 코인. */
  symbol?: string;
};

export default function TierBadge({ tier, symbol }: Props) {
  const style = BADGE[tier];
  return (
    <span
      className="flex-none rounded-sm border border-transparent px-2 py-0.5 text-xs font-semibold"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {tierLabel(tier, symbol)}
    </span>
  );
}
