"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["asset-visibility"] });
      await client.invalidateQueries({ queryKey: ["public-profile"] });
      await client.invalidateQueries({ queryKey: ["public-profile-items"] });
    },
  });
  if (!member) return null;
  return (
    <section className="mt-6 space-y-3 rounded-lg border border-border-subtle bg-surface p-5">
      <h2 className="font-semibold">공개 프로필의 코인별 보유 정보</h2>
      <p className="text-sm text-text-muted">
        공개 프로필에 표시할 코인을 선택하세요. 정확한 수량과 지갑 주소는 공개되지 않습니다. 전체
        자산 공개 설정이 비공개이면 아래 선택보다 우선합니다. 글·댓글 자체에 발행 당시 붙은 보유
        기록은 이 설정으로 변경되지 않습니다.
      </p>
      {settings.isPending ? (
        <p>설정 불러오는 중…</p>
      ) : settings.isError ? (
        <button onClick={() => settings.refetch()}>설정 재시도</button>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {settings.data.map((setting) => (
            <li key={setting.symbol}>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={setting.visible}
                  disabled={change.isPending}
                  onChange={(e) =>
                    change.mutate({ symbol: setting.symbol, visible: e.target.checked })
                  }
                />
                {setting.name} · {setting.symbol}
              </label>
            </li>
          ))}
        </ul>
      )}
      {change.isError && <p role="alert">{change.error.message}</p>}
    </section>
  );
}
