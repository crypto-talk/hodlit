import type { AnimalBadgeData } from "@/components/holder/animal-badge";
import { holdingPeriodLabel, isVerifiable, tierOf } from "./label";
import type { Tier } from "./types";

/**
 * 글에 붙은 코인별 보유 기록 (HODL-97 · 106, `attachedCoinSnapshots`).
 *
 * 발행할 때 서버가 방 코인 + 글쓴이가 고른 코인(최대 3개)마다 한 번 찍은 기록이다. 순서는
 * 방 코인 다음 고른 순서 그대로다. 이후 글을 고치거나 잔액이 바뀌어도 그대로다 — 프론트가
 * 지금 잔액으로 과거 기록을 만들지 않는다.
 *
 * 공개 범위는 서버가 정한다. 자산 전체 비공개면 빈 배열, 코인별 비공개 항목은 빠져서 온다.
 * 그래서 **빈 배열은 "보여 줄 기록이 없다"** 이고, 단일 `holderSnapshot` 으로 채우지 않는다.
 * 배열 필드 자체가 없을 때(필드가 생기기 전 응답)만 `null` 을 돌려 화면이 옛 방식으로 그린다.
 *
 * 문구는 `label.ts` 와 같은 규칙을 쓴다(구조 규칙 3). 수량 구간은 서버 문자열 그대로다.
 */

export type AttachedHolder = {
  symbol: string;
  /** 그 코인이 보유 인증을 지원하는지. false 면 배지 · 구간을 그리지 않는다. */
  verifiable: boolean;
  tier: Tier;
  holderStatus: string | null;
  /** 일부 수단 조회가 실패한 채 확인된 부분만으로 찍힌 기록(`syncStatus: PARTIAL`). */
  partial: boolean;
  /** 서버가 완성한 수량 구간. 보유가 확인되지 않았으면 null. */
  amount: string | null;
  /** 보유 기간 문구. 보유가 확인된 기록에만 의미가 있다. */
  holding: string;
  badge: AnimalBadgeData | null;
};

/** 응답의 한 항목. 생성 타입은 모든 필드가 선택이라 여기서 좁힌다. */
export type AttachedSnapshotRow = {
  coinSymbol?: string;
  verificationAvailability?: string;
  holderStatus?: string;
  verifiedHolder?: boolean;
  quantityBand?: string;
  holdingMonths?: number;
  verificationLevel?: string;
  syncStatus?: string;
  badge?: AnimalBadgeData;
};

export function toAttachedHolders(
  rows: AttachedSnapshotRow[] | null | undefined,
): AttachedHolder[] | null {
  if (!Array.isArray(rows)) return null;
  return rows
    .filter((row) => typeof row.coinSymbol === "string" && row.coinSymbol.length > 0)
    .map((row) => ({
      symbol: row.coinSymbol as string,
      verifiable: isVerifiable(row.verificationAvailability),
      tier: tierOf(row.verificationLevel, row.verifiedHolder, row.holderStatus),
      holderStatus: row.holderStatus ?? null,
      partial: row.syncStatus === "PARTIAL",
      amount: row.quantityBand ?? null,
      holding: holdingPeriodLabel(row.holdingMonths),
      badge: row.badge ?? null,
    }));
}

/** 방 코인을 뺀, 글쓴이가 고른 코인만. 목록 카드는 방 배지를 그리고 이것만 덧붙인다. */
export function extraAttachedSymbols(
  holders: AttachedHolder[] | null,
  roomSymbol: string,
): string[] {
  return (holders ?? []).map((holder) => holder.symbol).filter((symbol) => symbol !== roomSymbol);
}
