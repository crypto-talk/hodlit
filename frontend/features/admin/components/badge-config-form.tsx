"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AnimalBadge from "@/components/holder/animal-badge";
import { saveBadgeConfig } from "../api";
import type { BadgeConfig, BadgePresets, BadgeTier } from "../types";

export default function BadgeConfigForm({
  initial,
  presets,
}: {
  initial: BadgeConfig;
  presets: BadgePresets;
}) {
  const [tiers, setTiers] = useState(initial.tiers);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => saveBadgeConfig(initial.symbol, { ...initial, tiers }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["badge-config", initial.symbol] }),
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
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p>설정 버전 {initial.version}</p>
      {tiers.map((tier, index) => (
        <fieldset
          key={index}
          className="flex flex-wrap items-center gap-3 rounded border border-border-subtle p-3"
        >
          <legend>{index + 1}등급</legend>
          <label>
            이름{" "}
            <input
              value={tier.name}
              required
              maxLength={40}
              onChange={(e) => update(index, { name: e.target.value })}
              className="w-24 border p-2"
            />
          </label>
          <label>
            최소 수량{" "}
            <input
              value={tier.minimumQuantity}
              inputMode="decimal"
              required
              pattern="[0-9]+(\.[0-9]{1,18})?"
              onChange={(e) => update(index, { minimumQuantity: e.target.value })}
              className="w-32 border p-2"
            />
          </label>
          {(["icon", "color", "effect"] as const).map((field) => (
            <label key={field}>
              {field === "icon" ? "아이콘" : field === "color" ? "색상" : "효과"}{" "}
              <select
                value={tier[field]}
                onChange={(e) => update(index, { [field]: e.target.value })}
                className="border p-2"
              >
                {presets[field === "icon" ? "icons" : field === "color" ? "colors" : "effects"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
          ))}
          <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
            위로
          </button>
          <button
            type="button"
            disabled={index === tiers.length - 1}
            onClick={() => move(index, 1)}
          >
            아래로
          </button>
          <button
            type="button"
            onClick={() => setTiers((values) => values.filter((_, i) => i !== index))}
          >
            삭제
          </button>
          <div className="flex flex-wrap gap-2" aria-label="위치별 미리보기">
            <AnimalBadge
              badge={{
                ...tier,
                version: initial.version,
                quantityBand: `${tier.minimumQuantity} 이상 ${initial.symbol}`,
              }}
              position="detail"
            />
            <AnimalBadge
              badge={{
                ...tier,
                version: initial.version,
                quantityBand: `${tier.minimumQuantity} 이상 ${initial.symbol}`,
              }}
              position="list"
            />
            <AnimalBadge
              badge={{
                ...tier,
                version: initial.version,
                quantityBand: `${tier.minimumQuantity} 이상 ${initial.symbol}`,
              }}
              position="comment"
            />
          </div>
        </fieldset>
      ))}
      <div className="flex gap-4">
        <button
          type="button"
          disabled={tiers.length >= 20}
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
          등급 추가
        </button>
        <button disabled={mutation.isPending || tiers.length === 0}>
          {mutation.isPending ? "저장 중…" : "등급 설정 저장"}
        </button>
      </div>
      {mutation.isError && (
        <p role="alert">
          {mutation.error.message} 설정이 충돌했다면 페이지를 새로고침해 최신 버전을 확인하세요.
        </p>
      )}
    </form>
  );
}
