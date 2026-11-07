"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { loadAssetVisibility, saveAssetVisibility } from "../api";

export default function AssetPrivacy() {
  const { member } = useSession();
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ["asset-visibility", member?.id],
    queryFn: loadAssetVisibility,
    enabled: !!member,
  });
  const change = useMutation({
    mutationFn: ({ symbol, visible }: { symbol: string; visible: boolean }) =>
      saveAssetVisibility(symbol, visible),
    onError: (error) => {
      toast.error(error.message || "공개 설정을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["asset-visibility"] });
      await client.invalidateQueries({ queryKey: ["public-profile"] });
      await client.invalidateQueries({ queryKey: ["public-profile-items"] });
    },
  });
  if (!member) return null;
  return (
    <section className="mt-6 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-5">
      <div>
        <h2 className="font-semibold text-text-primary">공개 프로필의 코인별 보유 정보</h2>
        <p className="mt-1 text-sm text-text-muted">
          공개 프로필에 표시할 코인을 선택하세요. 정확한 수량과 지갑 주소는 공개되지 않습니다.
        </p>
        <p className="mt-1 text-xs text-text-subtle">
          전체 자산 공개 설정이 비공개이면 아래 선택보다 우선합니다. 글·댓글에 발행 당시 붙은 보유
          기록은 이 설정으로 바뀌지 않습니다.
        </p>
      </div>
      {settings.isPending ? (
        <p className="py-4 text-sm text-text-muted">설정 불러오는 중…</p>
      ) : settings.isError ? (
        <p className="py-4 text-sm text-text-muted">
          설정을 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void settings.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : (
        <ul className="grid gap-2 min-[600px]:grid-cols-2">
          {settings.data.map((setting) => (
            <li key={setting.symbol}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 text-sm ${
                  setting.visible
                    ? "border-border-subtle bg-surface"
                    : "border-transparent bg-surface-muted text-text-muted"
                } ${change.isPending ? "cursor-default opacity-60" : "hover:border-text-muted"}`}
              >
                <input
                  type="checkbox"
                  checked={setting.visible}
                  disabled={change.isPending}
                  onChange={(e) =>
                    change.mutate({ symbol: setting.symbol, visible: e.target.checked })
                  }
                  className="size-4 flex-none accent-brand"
                />
                <span className="w-12 flex-none font-semibold">{setting.symbol}</span>
                <span className="min-w-0 flex-1 truncate">{setting.name}</span>
                <span className="flex-none text-xs text-text-subtle">
                  {setting.visible ? "공개" : "비공개"}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
