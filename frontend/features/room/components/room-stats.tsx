"use client";

import { useQuery } from "@tanstack/react-query";
import { loadRoomStats } from "../api";
import type { StatsWindow } from "../types";

const WINDOWS: { window: StatsWindow; label: string }[] = [
  { window: "24h", label: "최근 24시간" },
  { window: "all", label: "누적" },
];

/** 인증률 표기. 소수 첫째 자리까지, 정수면 소수점을 떼고 보인다(25 → 25%, 33.33 → 33.3%). */
export function rateText(rate: number): string {
  return `${Number(rate.toFixed(1)).toLocaleString("ko-KR")}%`;
}

/**
 * 방 참여 통계 칸 (HODL-112). 최근 24시간과 누적을 나란히 보여 준다.
 *
 * - 참여자는 로그인한 채 글 · 댓글 · 좋아요를 남기거나 글을 읽은 회원이다. 가입자 수가 아니라서 그렇게 적지 않는다.
 * - 보유 인증률은 참여자 중 지금 이 코인 보유가 인증된 회원의 비율이다. 인증을 지원하지 않는 방은 숨긴다.
 * - 참여자가 0명인 것("아직 없음")과 못 불러온 것("불러오지 못함")을 다르게 적는다.
 *
 * 통계가 안 와도 방의 나머지(글 · 시세)는 그대로 보여야 하므로 오류는 이 칸 안에서만 알린다.
 */
export default function RoomStats({ symbol, verifiable }: { symbol: string; verifiable: boolean }) {
  return (
    <section
      aria-label="방 참여 통계"
      className="rounded-lg border border-border-subtle bg-surface p-4"
    >
      <dl className="grid grid-cols-2 gap-4 max-shell:grid-cols-1">
        {WINDOWS.map(({ window, label }) => (
          <StatsRow
            key={window}
            symbol={symbol}
            window={window}
            label={label}
            verifiable={verifiable}
          />
        ))}
      </dl>
      <p className="mt-3 text-xs text-text-muted">
        참여자는 로그인한 채 글 · 댓글 · 좋아요를 남기거나 글을 읽은 회원 수입니다.
        {verifiable ? " 보유 인증률은 그중 지금 이 코인 보유가 인증된 회원의 비율입니다." : ""}
      </p>
    </section>
  );
}

function StatsRow({
  symbol,
  window,
  label,
  verifiable,
}: {
  symbol: string;
  window: StatsWindow;
  label: string;
  verifiable: boolean;
}) {
  const stats = useQuery({
    queryKey: ["room-stats", symbol, window],
    queryFn: () => loadRoomStats(symbol, window),
    staleTime: 60_000,
  });

  return (
    <div>
      <dt className="text-xs font-semibold text-text-muted">{label}</dt>
      <dd className="mt-1 text-body text-text-primary">
        {stats.isPending ? (
          <span className="text-sm text-text-muted">불러오는 중…</span>
        ) : stats.isError ? (
          <span className="text-sm text-text-muted">
            통계를 불러오지 못했습니다.{" "}
            <button
              type="button"
              className="font-semibold text-brand"
              onClick={() => stats.refetch()}
            >
              다시 시도
            </button>
          </span>
        ) : stats.data.participants === 0 ? (
          <span className="text-sm text-text-muted">아직 참여자가 없습니다.</span>
        ) : (
          <>
            참여자{" "}
            <span className="font-semibold tabular-nums">
              {stats.data.participants.toLocaleString("ko-KR")}
            </span>
            명
            {verifiable && stats.data.verifiedRate !== null ? (
              <>
                {" · "}보유 인증률{" "}
                <span className="font-semibold tabular-nums">
                  {rateText(stats.data.verifiedRate)}
                </span>
              </>
            ) : null}
          </>
        )}
      </dd>
    </div>
  );
}
