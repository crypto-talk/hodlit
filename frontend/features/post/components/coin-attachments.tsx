"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { isGeneralRoom } from "@/lib/room-status";
import { useSession } from "@/lib/session";
import { loadHoldingsReference } from "../api";
import { ATTACH_MAX, attachOptions, isAttachable } from "../attach";
import { referenceLabel, referenceOf, type HoldingsReference } from "../holdings";
import type { WriteRoom } from "../types";

type Props = {
  /** 고른 방. 비어 있으면 아직 안 고른 것. */
  roomSymbol: string;
  /** 서버가 준 코인 목록 전부(닫힌 방 포함). 아직 안 왔으면 undefined. */
  rooms: WriteRoom[] | undefined;
  /** 방 코인을 뺀, 고른 코인. 고른 순서. */
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

const CHIP =
  "inline-flex min-h-9 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-sm tabular-nums";

/**
 * 글쓰기의 "이 글에 붙을 보유 기록" (HODL-106).
 *
 * - 방 코인은 고정 칩(서버가 자동으로 넣는다). 기타 방은 방 코인이 없어 칩도 없다
 * - 코인을 3개까지 더 붙일 수 있다. 보유 인증을 지원하는 코인이면 방이 닫혀 있어도 된다
 * - "코인 추가" 를 누르면 고를 수 있는 코인과 **지금 내 보유(참고용)** 가 나온다. `/me/assets` 가
 *   최대 15초 걸리고 지갑 · 거래소를 다시 부르므로, 펼칠 때 처음 한 번만 부른다
 * - 미보유 · 미연결 · 확인 실패 코인도 붙일 수 있다. 그 상태 그대로 기록된다
 *
 * 글에 남는 기록은 발행할 때 서버가 다시 확인해 찍는다. 여기 보이는 보유는 그 전 참고다.
 */
export default function CoinAttachments({ roomSymbol, rooms, value, onChange, disabled }: Props) {
  const { member } = useSession();
  const [open, setOpen] = useState(false);
  const general = isGeneralRoom(roomSymbol);
  const roomCoin = rooms?.find((room) => room.symbol === roomSymbol);

  const holdings = useQuery({
    queryKey: ["write-holdings", member?.id ?? null],
    queryFn: loadHoldingsReference,
    enabled: open && !!member,
    // 참고용이라 한 번 받으면 글 쓰는 동안 다시 부르지 않는다. 다시 보려면 "다시 확인".
    staleTime: Infinity,
    retry: false,
  });

  const options = rooms ? attachOptions(rooms, roomSymbol) : [];
  const full = value.length >= ATTACH_MAX;
  const reference = holdings.data;

  const add = (symbol: string) => {
    if (full || value.includes(symbol)) return;
    onChange([...value, symbol]);
  };
  const remove = (symbol: string) => onChange(value.filter((item) => item !== symbol));

  return (
    <section
      aria-labelledby="attach-title"
      className="mt-6 rounded-sm border border-border-subtle bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 id="attach-title" className="text-body font-semibold text-text-primary">
          이 글에 붙을 보유 기록
        </h2>
        <span className="text-xs text-text-muted tabular-nums" aria-live="polite">
          추가 {value.length}/{ATTACH_MAX}
        </span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2" aria-label="붙일 코인">
        {roomSymbol && !general ? (
          <li className={`${CHIP} border-border-subtle bg-canvas text-text-primary`}>
            <b className="font-semibold">{roomSymbol}</b>
            <span className="text-xs text-text-muted">방 코인 · 자동</span>
            {reference && roomCoin?.verifiable ? (
              <span className="text-xs text-text-muted">
                · {referenceLabel(referenceOf(reference, roomSymbol))}
              </span>
            ) : null}
          </li>
        ) : null}
        {value.map((symbol) => {
          const coin = rooms?.find((room) => room.symbol === symbol);
          const blocked = !!rooms && (!coin || !isAttachable(coin));
          return (
            <li
              key={symbol}
              className={`${CHIP} ${blocked ? "border-danger text-danger" : "border-brand/40 bg-brand/5 text-text-primary"}`}
            >
              <b className="font-semibold">{symbol}</b>
              {blocked ? (
                <span className="text-xs">지금 붙일 수 없음</span>
              ) : reference ? (
                <span className="text-xs text-text-muted">
                  {referenceLabel(referenceOf(reference, symbol))}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => remove(symbol)}
                disabled={disabled}
                aria-label={`${symbol} 빼기`}
                className="-mr-1 inline-flex size-7 items-center justify-center rounded-sm text-text-muted hover:bg-surface-muted hover:text-text-primary"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpen((now) => !now)}
            disabled={disabled || !rooms}
            aria-expanded={open}
            aria-controls="attach-options"
            className={`${CHIP} border-dashed border-border-subtle text-text-muted hover:border-text-muted hover:text-text-primary disabled:opacity-60`}
          >
            {open ? null : <Plus aria-hidden className="size-4" />}
            {open ? "목록 닫기" : "코인 추가"}
          </button>
        </li>
      </ul>

      {open ? (
        <div id="attach-options" className="mt-3 border-t border-border-subtle pt-3">
          <HoldingsStatus
            loading={holdings.isFetching}
            failed={holdings.isError}
            reference={reference}
            onRetry={() => void holdings.refetch()}
          />
          {options.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">더 붙일 수 있는 코인이 없습니다.</p>
          ) : (
            <ul
              className="mt-2 grid gap-1.5 min-[600px]:grid-cols-2"
              aria-label="붙일 수 있는 코인"
            >
              {options.map((coin) => {
                const picked = value.includes(coin.symbol);
                return (
                  <li key={coin.symbol}>
                    <button
                      type="button"
                      onClick={() => (picked ? remove(coin.symbol) : add(coin.symbol))}
                      disabled={disabled || (!picked && full)}
                      aria-pressed={picked}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm disabled:cursor-default disabled:opacity-50 ${
                        picked
                          ? "border-brand bg-brand/5"
                          : "border-border-subtle bg-canvas hover:border-text-muted"
                      }`}
                    >
                      <b className="w-12 flex-none font-semibold text-text-primary">
                        {coin.symbol}
                      </b>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-text-primary">
                          {coin.name}
                          {coin.open ? "" : " · 방 닫힘"}
                        </span>
                        {reference ? (
                          <span className="block truncate text-xs text-text-muted">
                            {referenceLabel(referenceOf(reference, coin.symbol))}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex-none text-xs font-semibold text-brand">
                        {picked ? "붙임 ✓" : full ? "" : "붙이기"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function HoldingsStatus({
  loading,
  failed,
  reference,
  onRetry,
}: {
  loading: boolean;
  failed: boolean;
  reference: HoldingsReference | undefined;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <p className="text-xs text-text-muted" aria-live="polite">
        내 보유 코인 확인중
      </p>
    );
  if (failed)
    return (
      <p className="text-xs text-text-muted">
        보유 코인을 확인하지 못했습니다.{" "}
        <button type="button" onClick={onRetry} className="font-semibold text-brand">
          다시 확인
        </button>
      </p>
    );
  if (!reference) return null;
  return (
    <p className="text-xs text-text-muted">
      {reference.connected
        ? "현재 시점 기준 코인 보유량입니다."
        : "연결된 지갑, 거래소가 없습니다."}{" "}
      <button type="button" onClick={onRetry} className="font-semibold text-brand">
        다시 확인
      </button>
    </p>
  );
}
