"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatKrw, formatKrwShort, formatQuantity, formatShare } from "@/lib/format/number";
import { formatClock } from "@/lib/format/time";
import { MYPAGE_WALLET_HREF } from "@/lib/routes";
import { usePortfolio } from "../hooks/use-portfolio";
import type { Portfolio } from "../types";
import PortfolioDonut from "./portfolio-donut";
import { sliceColor } from "./slice-style";

const SECTION = "rounded-lg border border-border-subtle bg-surface p-5";

/**
 * 마이페이지 내 자산 탭 (HODL-67): 연결된 지갑 · 거래소의 코인을 합산한 원화 비중.
 *
 * 상태는 다섯 가지다.
 *   - 확인 중   서버가 잔액을 다시 읽는다. 최대 15초
 *   - 조회 실패 요청 자체가 실패했거나, 연결은 있는데 어떤 잔액도 확인하지 못했다
 *   - 미연결   지갑도 거래소도 없다 → 지갑 탭으로 보낸다
 *   - 자산 없음 확인은 끝났고 보유한 코인이 없다
 *   - 차트     평가금액이 있는 코인으로 비중을 그린다. 일부 출처가 실패했으면 위에 알린다
 *
 * 본인만 보는 화면이라 정확한 금액 · 수량을 그대로 보여 준다. 글 · 댓글에 붙는 공개
 * 표기(수량 구간)와는 다르다.
 */
export default function PortfolioView() {
  const portfolio = usePortfolio();

  if (portfolio.isPending) {
    return (
      <section className={SECTION} aria-busy="true">
        <p className="text-sm text-text-muted">
          지갑 · 거래소 잔액을 확인하는 중입니다. 최대 15초 걸릴 수 있습니다.
        </p>
      </section>
    );
  }

  if (portfolio.isError) {
    return (
      <Failure
        message={portfolio.error.message || "자산을 불러오지 못했습니다."}
        retrying={portfolio.isFetching}
        onRetry={() => portfolio.refetch()}
      />
    );
  }

  const data = portfolio.data;

  if (!data.connected) {
    return (
      <section className={SECTION}>
        <h2 className="text-body font-semibold">연결된 지갑이나 거래소가 없습니다</h2>
        <p className="mt-1 text-sm text-text-muted">
          지갑을 연결하면 보유 코인의 비중을 원형 차트로 보여 드립니다.
        </p>
        <Button asChild className="mt-4">
          <Link href={MYPAGE_WALLET_HREF}>지갑 연결하러 가기</Link>
        </Button>
      </section>
    );
  }

  const nothingConfirmed = data.holdings.length === 0 && data.unpriced.length === 0;

  if (nothingConfirmed && data.incomplete.length > 0) {
    return (
      <Failure
        message="연결된 지갑 · 거래소의 잔액을 확인하지 못했습니다. 거래소 키가 만료됐거나 일시적인 조회 실패일 수 있습니다."
        retrying={portfolio.isFetching}
        onRetry={() => portfolio.refetch()}
      />
    );
  }

  if (nothingConfirmed) {
    return (
      <section className={SECTION}>
        <h2 className="text-body font-semibold">보유 중인 코인이 없습니다</h2>
        <p className="mt-1 text-sm text-text-muted">{SCOPE_NOTE}</p>
      </section>
    );
  }

  return (
    <Chart data={data} refreshing={portfolio.isFetching} onRefresh={() => portfolio.refetch()} />
  );
}

const SCOPE_NOTE = "호들잇에 방이 있는 코인만 집계합니다. 원화 예수금과 방이 없는 토큰은 빠집니다.";

function Chart({
  data,
  refreshing,
  onRefresh,
}: {
  data: Portfolio;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section aria-labelledby="portfolio-title" className={SECTION}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="portfolio-title" className="text-body font-semibold">
          내 자산 비중
        </h2>
        <span className="text-xs text-text-muted">
          원화 평가금액 기준
          {data.capturedAt ? ` · ${formatClock(Date.parse(data.capturedAt))} 확인` : ""}
        </span>
        <button
          type="button"
          className="ml-auto cursor-pointer text-xs font-semibold text-text-muted hover:text-text-primary disabled:cursor-default disabled:opacity-60"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "확인 중…" : "다시 불러오기"}
        </button>
      </div>

      {data.incomplete.length > 0 ? (
        <p
          role="status"
          className="mt-3 rounded-md border border-border-subtle bg-surface-muted px-3 py-2 text-xs text-text-muted"
        >
          일부 지갑 네트워크나 거래소를 조회하지 못했습니다({data.incomplete.join(" · ")}). 확인된
          잔액만 반영했습니다.
        </p>
      ) : null}

      {data.slices.length > 0 ? (
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <PortfolioDonut
            slices={data.slices}
            centerValue={formatKrwShort(data.totalKrw)}
            active={active}
            onActive={setActive}
          />

          <ul aria-label="코인별 비중" className="flex w-full min-w-0 flex-col">
            {data.slices.map((slice) => (
              <li
                key={slice.key}
                className={`flex items-center gap-3 border-b border-border-subtle py-2.5 transition-opacity last:border-b-0 ${
                  active !== null && active !== slice.key ? "opacity-40" : ""
                }`}
                onMouseEnter={() => setActive(slice.key)}
                onMouseLeave={() => setActive(null)}
              >
                <span
                  aria-hidden
                  className="size-2.5 flex-none rounded-full"
                  style={{ background: sliceColor(slice.colorSlot) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{slice.label}</span>
                  <span className="block truncate text-xs text-text-muted">{slice.detail}</span>
                </span>
                <span className="flex-none text-right">
                  <span className="block text-sm font-semibold tabular-nums">
                    {formatShare(slice.share)}
                  </span>
                  <span className="block text-xs text-text-muted tabular-nums">
                    {formatKrw(slice.valueKrw)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-muted">
          평가금액을 받은 코인이 없어 비중을 그리지 못했습니다.
        </p>
      )}

      {data.unpriced.length > 0 ? (
        <div className="mt-5 border-t border-border-subtle pt-4">
          <h3 className="text-sm font-semibold">비중에서 뺀 코인</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.unpriced.map((holding) => (
              <li key={holding.symbol} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {holding.name} <span className="text-text-muted">{holding.symbol}</span>
                </span>
                <span className="flex-none text-xs text-text-muted tabular-nums">
                  {formatQuantity(holding.quantity)} {holding.symbol}
                </span>
                <span className="flex-none text-xs text-text-muted">
                  {holding.reason === "partial" ? "일부 조회 실패" : "시세 없음"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-muted">
            잔액을 모두 확인하지 못했거나 원화 시세를 받지 못한 코인은 금액을 정할 수 없어 비중
            계산에서 뺐습니다.
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-text-muted">{SCOPE_NOTE}</p>
    </section>
  );
}

function Failure({
  message,
  retrying,
  onRetry,
}: {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <section className={SECTION}>
      <h2 className="text-body font-semibold">자산을 불러오지 못했습니다</h2>
      <p className="mt-1 text-sm text-text-muted">{message}</p>
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        disabled={retrying}
        onClick={onRetry}
      >
        {retrying ? "확인 중…" : "다시 불러오기"}
      </Button>
    </section>
  );
}
