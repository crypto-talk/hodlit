"use client";

import { useState } from "react";
import { effectAt, type BadgePosition } from "@/lib/holder-snapshot/badge-effect";
import { animalBadgeExplanation } from "@/lib/holder-snapshot/label";
import type { Tier } from "@/lib/holder-snapshot/types";

export type AnimalBadgeData = {
  version?: number;
  name?: string;
  quantityBand?: string;
  icon?: string;
  color?: string;
  effect?: string;
};

const PATHS: Record<string, string> = {
  shrimp: "M17 6a7 7 0 1 0 1 11l-3-3M17 6l3-3m-3 3 4 1M5 8l4 2m-5 3h4m-2 5 3-3m4 3v3",
  fish: "M16 8c-6-6-12 4-12 4s6 10 12 4l5 3V5l-5 3ZM8 11h.01",
  dolphin: "M3 15c4-7 9-9 15-6l4 3-5 1c-1 6-5 7-8 6l3-4-9 3v-3ZM12 8l1-5 4 5",
  shark: "M2 15c4-6 11-9 17-4l3-3v9l-4-2c-4 4-10 4-16 0ZM10 9l3-6 3 6m-3 5 1 3m2-4 1 3",
  whale: "M3 12c1-6 10-7 13-2l3 3 3-3-1 7c-4 6-17 5-18-5Zm7-7V2m0 0L7 3m3-1 3 1M7 12h.01",
};

const COLORS = ["coral", "mint", "blue", "purple", "gold"];
type Props = {
  badge: AnimalBadgeData | null | undefined;
  position?: BadgePosition;
  /** 어떤 수단으로 확인한 보유인지. 설명에만 쓴다. */
  tier?: Tier;
  /** 일부만 조회된 기록인지. 설명에만 쓴다. */
  partial?: boolean;
};

/**
 * 보유량 동물 등급 배지 (HODL-79). 등급 · 아이콘 · 색 · 효과는 전부 글 · 댓글을 쓸 때 서버가
 * 찍어 둔 값이다. 지금 보유량이나 시세로 다시 계산하지 않는다.
 *
 * 누르면 설명이 아래에 펼쳐진다 — 터치 화면에는 툴팁이 없어서다.
 */
export default function AnimalBadge({ badge, position = "list", tier, partial }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!badge?.name) return null;
  const explanation = animalBadgeExplanation(badge, { tier, partial });
  const color = COLORS.includes(badge.color ?? "") ? badge.color : "blue";
  const effect = effectAt(position, badge.effect);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={`animal-badge animal-${color} animal-effect-${effect} inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-semibold`}
        title={explanation}
        aria-label={explanation}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          className={position === "detail" ? "size-6" : "size-4"}
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={PATHS[badge.icon ?? "fish"] ?? PATHS.fish} />
        </svg>
        {position !== "comment" && (
          <span>
            {badge.name}
            {position === "detail" ? ` · ${badge.quantityBand ?? ""}` : ""}
          </span>
        )}
      </button>
      {expanded && (
        <span role="status" className="max-w-64 text-xs text-text-muted">
          {explanation}
        </span>
      )}
    </span>
  );
}
