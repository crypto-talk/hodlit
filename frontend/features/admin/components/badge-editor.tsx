"use client";

import { useQuery } from "@tanstack/react-query";
import { loadBadgeConfig, loadBadgePresets } from "../api";
import BadgeConfigForm from "./badge-config-form";

export default function BadgeEditor({ symbol, close }: { symbol: string; close: () => void }) {
  const config = useQuery({
    queryKey: ["badge-config", symbol],
    queryFn: () => loadBadgeConfig(symbol),
  });
  const presets = useQuery({ queryKey: ["badge-presets"], queryFn: loadBadgePresets });
  return (
    <section
      className="space-y-4 rounded-lg border border-border-subtle bg-surface p-4"
      aria-label={`${symbol} 등급 설정`}
    >
      <div className="flex justify-between">
        <h2 className="font-semibold">{symbol} 보유 등급 설정</h2>
        <button onClick={close}>닫기</button>
      </div>
      <p className="text-sm text-text-muted">
        첫 하한은 0이며 양수 보유자부터 적용됩니다. 이후 하한은 오름차순으로 입력하세요. 각 상한은
        다음 등급의 하한이며 마지막 등급은 상한이 없습니다. 저장 후 새로 작성하는 글·댓글에만
        적용됩니다.
      </p>
      {config.isError || presets.isError ? (
        <button
          onClick={() => {
            config.refetch();
            presets.refetch();
          }}
        >
          설정 불러오기 재시도
        </button>
      ) : !config.data || !presets.data ? (
        <p>설정 불러오는 중…</p>
      ) : (
        <BadgeConfigForm key={config.data.version} initial={config.data} presets={presets.data} />
      )}
    </section>
  );
}
