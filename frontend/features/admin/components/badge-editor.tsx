"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
      className="flex flex-col gap-4 border-t border-border-subtle pt-5"
      aria-label={`${symbol} 등급 설정`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-text-primary">{symbol} 보유 등급</h3>
          <p className="mt-1 text-sm text-text-muted">
            첫 하한은 0이며 양수 보유자부터 적용됩니다. 이후 하한은 오름차순으로 입력하세요. 각
            상한은 다음 등급의 하한이며 마지막 등급은 상한이 없습니다.
          </p>
          <p className="mt-1 text-sm text-text-muted">
            저장 후 새로 작성하는 글·댓글에만 적용됩니다. 이미 붙은 배지는 바뀌지 않습니다.
          </p>
        </div>
        <Button type="button" onClick={close} className="flex-none">
          닫기
        </Button>
      </div>
      {config.isError || presets.isError ? (
        <p className="py-6 text-center text-sm text-text-muted">
          등급 설정을 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => {
              void config.refetch();
              void presets.refetch();
            }}
          >
            다시 시도
          </button>
        </p>
      ) : !config.data || !presets.data ? (
        <p className="py-6 text-center text-sm text-text-muted">불러오는 중…</p>
      ) : (
        <BadgeConfigForm key={config.data.version} initial={config.data} presets={presets.data} />
      )}
    </section>
  );
}
