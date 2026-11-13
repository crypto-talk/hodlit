"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AnimalBadge from "@/components/holder/animal-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { saveBadgeConfig } from "../api";
import {
  TIER_MAX,
  TIER_NAME_MAX,
  bandPreview,
  configProblem,
  rangeText,
  sameTiers,
  tierProblems,
} from "../badge-tiers";
import type { BadgeConfig, BadgePresets, BadgeTier } from "../types";

/** 프리셋 값 → 화면 이름. 서버가 새 값을 주면 값 그대로 보인다. */
const PRESET_LABEL: Record<string, string> = {
  shrimp: "새우",
  fish: "물고기",
  dolphin: "돌고래",
  shark: "상어",
  whale: "고래",
  coral: "코랄",
  mint: "민트",
  blue: "파랑",
  purple: "보라",
  gold: "골드",
  none: "없음",
  soft: "옅은 면",
  border: "테두리",
  shine: "한 번 반짝",
  flow: "흐르는 테두리",
  aurora: "오로라",
};

const FIELDS = [
  { key: "icon", label: "아이콘", preset: "icons" },
  { key: "color", label: "색상", preset: "colors" },
  { key: "effect", label: "효과", preset: "effects" },
] as const;

const ICON_BUTTON = "size-9 px-0 py-0";

/**
 * 방별 보유 등급 설정 폼 (HODL-83).
 *
 * - 등급마다 구간을 말로 보여 준다(`0.1 이상 1 미만`). 위쪽 끝은 다음 등급의 최소 수량이라 따로 적지 않는다
 * - 겹치거나 거꾸로 된 구간은 그 등급 아래에 바로 안내하고 저장을 막는다. 서버도 같은 검사를 한다
 * - 저장한 설정과 달라지면 "저장하지 않은 변경" 을 보이고, 그대로 창을 닫으려 하면 브라우저가 묻는다
 * - 저장은 새 글 · 댓글부터 적용된다. 이미 붙은 배지는 바뀌지 않는다
 */
export default function BadgeConfigForm({
  initial,
  presets,
}: {
  initial: BadgeConfig;
  presets: BadgePresets;
}) {
  const [tiers, setTiers] = useState(initial.tiers);
  const client = useQueryClient();
  const problems = tierProblems(tiers);
  const blocked = configProblem(tiers);
  const dirty = !sameTiers(tiers, initial.tiers);

  // 저장하지 않고 창을 닫거나 새로고침하면 브라우저가 한 번 묻는다. 화면 안에서 이동하는 것까지는
  // 막지 않는다 — 관리자 화면이라 실수해도 다시 고치면 된다.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mutation = useMutation({
    mutationFn: () => saveBadgeConfig(initial.symbol, { ...initial, tiers }),
    onSuccess: () => {
      toast.success(`${initial.symbol} 등급 설정을 저장했습니다. 새 글·댓글부터 적용됩니다.`);
      return client.invalidateQueries({ queryKey: ["badge-config", initial.symbol] });
    },
    onError: (error) => {
      toast.error(
        `${error.message || "등급 설정을 저장하지 못했습니다."} 설정이 충돌했다면 새로고침해 최신 버전을 확인하세요.`,
      );
    },
  });
  function update(index: number, patch: Partial<BadgeTier>) {
    setTiers((values) => values.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }
  function move(index: number, offset: number) {
    setTiers((values) => {
      const next = [...values];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocked || !dirty) return;
        mutation.mutate();
      }}
    >
      <p className="text-xs text-text-subtle">설정 버전 {initial.version}</p>
      <ol className="flex flex-col gap-3">
        {tiers.map((tier, index) => {
          const preview = {
            ...tier,
            version: initial.version,
            quantityBand: bandPreview(tiers, index, initial.symbol),
          };
          return (
            <li key={index} className="rounded-lg border border-border-subtle bg-surface p-4">
              <div
                role="group"
                aria-labelledby={`badge-tier-${index}`}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4
                    id={`badge-tier-${index}`}
                    className="text-sm font-semibold text-text-primary"
                  >
                    {index + 1}등급
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      className={ICON_BUTTON}
                      aria-label={`${index + 1}등급 위로`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      className={ICON_BUTTON}
                      aria-label={`${index + 1}등급 아래로`}
                      disabled={index === tiers.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown />
                    </Button>
                    <Button
                      type="button"
                      className={`${ICON_BUTTON} text-danger hover:border-danger`}
                      aria-label={`${index + 1}등급 삭제`}
                      onClick={() => setTiers((values) => values.filter((_, i) => i !== index))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-5">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-text-muted">이름</span>
                    <Input
                      value={tier.name}
                      required
                      maxLength={TIER_NAME_MAX}
                      onChange={(e) => update(index, { name: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-text-muted">
                      최소 수량 ({initial.symbol})
                    </span>
                    <Input
                      value={tier.minimumQuantity}
                      inputMode="decimal"
                      required
                      aria-invalid={problems[index] ? true : undefined}
                      aria-describedby={`badge-tier-${index}-range`}
                      onChange={(e) => update(index, { minimumQuantity: e.target.value })}
                      className="tabular-nums"
                    />
                  </label>
                  {FIELDS.map((field) => (
                    <label key={field.key} className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-text-muted">{field.label}</span>
                      <NativeSelect
                        value={tier[field.key]}
                        onChange={(e) => update(index, { [field.key]: e.target.value })}
                      >
                        {presets[field.preset].map((value) => (
                          <option key={value} value={value}>
                            {PRESET_LABEL[value] ?? value}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  ))}
                </div>

                <p id={`badge-tier-${index}-range`} className="text-xs text-text-muted">
                  구간{" "}
                  <b className="font-semibold text-text-primary tabular-nums">
                    {rangeText(tiers, index)}
                  </b>{" "}
                  {initial.symbol}
                </p>
                {problems[index] ? (
                  <p role="alert" className="text-xs text-danger">
                    {problems[index]}
                  </p>
                ) : null}

                <div
                  className="flex flex-wrap items-start gap-x-6 gap-y-3 rounded-sm bg-surface-muted px-4 py-3"
                  aria-label="위치별 미리보기"
                >
                  <PreviewSlot label="글 상세">
                    <AnimalBadge badge={preview} position="detail" />
                  </PreviewSlot>
                  <PreviewSlot label="목록">
                    <AnimalBadge badge={preview} position="list" />
                  </PreviewSlot>
                  <PreviewSlot label="댓글">
                    <AnimalBadge badge={preview} position="comment" />
                  </PreviewSlot>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          disabled={tiers.length >= TIER_MAX}
          onClick={() =>
            setTiers((values) => [
              ...values,
              {
                name: "새 등급",
                minimumQuantity: "0",
                icon: "fish",
                color: "mint",
                effect: "none",
              },
            ])
          }
        >
          <Plus />
          등급 추가
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          {dirty ? (
            <>
              <span className="text-xs font-semibold text-text-primary" role="status">
                저장하지 않은 변경이 있습니다
              </span>
              <Button
                type="button"
                disabled={mutation.isPending}
                onClick={() => setTiers(initial.tiers)}
              >
                되돌리기
              </Button>
            </>
          ) : (
            <span className="text-xs text-text-muted">저장된 설정과 같습니다</span>
          )}
          <Button variant="primary" disabled={mutation.isPending || !dirty || blocked !== null}>
            {mutation.isPending ? "저장 중…" : "등급 설정 저장"}
          </Button>
        </div>
      </div>
      {blocked ? (
        <p role="alert" className="text-right text-xs text-danger">
          {blocked}
        </p>
      ) : null}
    </form>
  );
}

function PreviewSlot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-subtle">{label}</span>
      {children}
    </div>
  );
}
