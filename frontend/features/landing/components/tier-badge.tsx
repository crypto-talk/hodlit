import type { Tier } from "../types";

type BadgeStyle = {
  label: string;
  bg: string;
  color: string;
  border: string;
};

/**
 * 인증 등급 배지. 지갑연결 / 거래소연동 / 미인증 3단계.
 *
 * 색은 tokens.css 의 배지 토큰을 가리킨다. 배지만 따로 색을 가야 하면 거기를
 * 고친다 — 여기에 값을 적지 않는다.
 */
const BADGE: Record<Tier, BadgeStyle> = {
  wallet: {
    label: "지갑연결",
    bg: "var(--badge-wallet-bg)",
    color: "var(--badge-wallet-text)",
    border: "transparent",
  },
  exchange: {
    label: "거래소연동",
    bg: "var(--badge-exchange-bg)",
    color: "var(--badge-exchange-text)",
    border: "transparent",
  },
  none: {
    label: "미인증",
    bg: "transparent",
    color: "var(--badge-none-text)",
    border: "var(--badge-none-border)",
  },
};

export default function TierBadge({ tier }: { tier: Tier }) {
  const style = BADGE[tier];
  return (
    <span
      className="hd-badge"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {style.label}
    </span>
  );
}
