"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatKrw } from "@/lib/format/number";
import { loadRoomPrice } from "../api";

type Props = {
  symbol: string;
  name: string;
};

/** 시세 갱신 주기 (B-5: 실시간 없음, 시세는 1분 폴링). */
const REFRESH_MS = 60_000;

const DIRECTION_COLOR = {
  up: "text-success",
  down: "text-danger",
  flat: "text-text-muted",
} as const;

/**
 * 방 대문 위칸 — 코인 · 현재가 · 24시간 등락률.
 *
 * 1분마다 다시 받고 남은 시간을 보여준다. 과거 시세 API 가 없어서 와이어프레임의
 * 가격 차트(1D·1W·1M·1Y)는 그리지 않는다. 비슷해 보이는 가짜 선을 그리지 않는다.
 *
 * 실패해도 이 칸 안에서만 알린다(구조 규칙 9). 게시판은 그대로 읽힌다.
 */
export default function RoomPrice({ symbol, name }: Props) {
  const price = useQuery({
    queryKey: ["room-price", symbol],
    queryFn: () => loadRoomPrice(symbol),
    refetchInterval: REFRESH_MS,
  });

  return (
    <section
      aria-label={`${symbol} 시세`}
      className="rounded-lg border border-border-subtle bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="text-sm font-semibold text-text-muted">{name} 시세</span>
        <span className="flex-1" />
        {price.isSuccess ? <Countdown updatedAt={price.dataUpdatedAt} /> : null}
      </div>

      {price.isPending ? <p className="mt-2 text-sm text-text-muted">시세를 불러오는 중…</p> : null}

      {price.isError ? (
        <p className="mt-2 text-sm text-text-muted">
          시세를 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="font-semibold text-brand"
            onClick={() => price.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : null}

      {price.isSuccess && !price.data ? (
        <p className="mt-2 text-sm text-text-muted">이 코인은 시세 정보가 없습니다.</p>
      ) : null}

      {price.isSuccess && price.data ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-h1 font-semibold text-text-primary tabular-nums">
            {formatKrw(price.data.price)}
          </span>
          <span
            className={`text-body font-semibold tabular-nums ${DIRECTION_COLOR[price.data.direction]}`}
          >
            {price.data.change}
          </span>
          <span className="text-xs text-text-muted">24시간</span>
        </div>
      ) : null}
    </section>
  );
}

/** 다음 갱신까지 남은 초. 1초마다 다시 그린다. */
function Countdown({ updatedAt }: { updatedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(0, Math.ceil((updatedAt + REFRESH_MS - now) / 1000));

  return (
    <span className="text-xs text-text-muted tabular-nums" aria-live="off">
      {left > 0 ? `${left}초 후 갱신` : "갱신 중…"}
    </span>
  );
}
