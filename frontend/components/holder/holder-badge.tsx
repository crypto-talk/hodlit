import type { BadgePosition } from "@/lib/holder-snapshot/badge-effect";
import type { Tier } from "@/lib/holder-snapshot/types";
import AnimalBadge, { type AnimalBadgeData } from "./animal-badge";
import TierBadge from "./tier-badge";

type Props = {
  /** 작성 시점에 찍힌 동물 등급. 없으면 예전 4단계 배지로 그린다. */
  badge?: AnimalBadgeData | null;
  tier: Tier;
  /** 미보유일 때 `ETH 미보유` 처럼 붙일 코인. */
  symbol?: string;
  holderStatus?: string | null;
  partial?: boolean;
  position?: BadgePosition;
};

/**
 * 글 · 댓글 작성자 옆에 붙는 보유 배지 한 칸.
 *
 * 동물 등급이 찍힌 기록은 동물 배지만 그린다. `지갑연결` · `거래소연동` 배지와 나란히 두지
 * 않는다(2026-11-11 성지) — 둘 다 "보유자"라는 같은 말이라 한 줄에 두 번 나오면 소음이다.
 * 어떤 수단으로 확인했는지는 동물 배지의 설명에 남는다.
 *
 * 동물 등급이 없는 기록(등급 설정 전의 글 · 미보유 · 미인증 · 조회 실패)은 예전 배지 그대로다.
 * 보유자가 아니면 서버가 동물 등급을 찍지 않으므로 여기서 등급을 지어내지 않는다.
 */
export default function HolderBadge({
  badge,
  tier,
  symbol,
  holderStatus,
  partial,
  position = "list",
}: Props) {
  if (badge?.name) {
    return <AnimalBadge badge={badge} position={position} tier={tier} partial={partial} />;
  }
  return <TierBadge tier={tier} symbol={symbol} holderStatus={holderStatus} />;
}
