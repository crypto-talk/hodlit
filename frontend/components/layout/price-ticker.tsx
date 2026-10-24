"use client";

import { formatChangeRate, formatCoinKrw } from "@/lib/format/number";
import type { QuoteSource, SymbolQuote } from "@/lib/market-price/quote";
import { useSourceMarketQuotes } from "@/lib/market-price/use-market-price";

/**
 * 전광판이 보여 줄 출처. 지금은 한국 사용자 대상이라 업비트 원화 마켓만 흘린다
 * (2026-10-21 성지 결정). 등락률이 모두 전일 대비라 칸마다 기준을 적지 않는다.
 * 업비트에 원화 마켓이 없는 BNB · LTC · TON 은 전광판에 없다(방 시세 칸에는 CoinGecko 로 나온다).
 *
 * 해외 사용자 대상이 되면 CoinGecko 로 바꾼다. 그때는 `coingecko.ts` 가 세 코인만이 아니라
 * 모든 코인을 받도록 바꾸고, 등락률 기준(24시간)도 전광판 어딘가에 적어야 한다.
 */
const TICKER_SOURCE: QuoteSource = "upbit";

/** 한 칸이 화면을 지나는 시간(초). 코인 수가 바뀌어도 흐르는 속도가 같도록 칸 수에 곱한다. */
const SECONDS_PER_CELL = 4;

const DIRECTION = {
  up: { arrow: "▲", label: "상승", color: "text-success" },
  down: { arrow: "▼", label: "하락", color: "text-danger" },
  flat: { arrow: "", label: "보합", color: "text-text-muted" },
} as const;

/**
 * 셸 상단 시세 전광판 (HODL-57).
 *
 * 예전 띠의 서비스 문구(목값)를 코인 시세로 바꿨다. 셸 레이아웃이 그리므로 랜딩만이 아니라
 * 화면군 전체에 걸린다. 값은 방 시세 칸과 같은 쿼리(`lib/market-price/`)에서 오고 30초마다
 * 다시 받는다. 값이 바뀌어도 반짝이지 않는다(성지 결정) — 숫자만 조용히 바뀐다.
 *
 * 끊김 없이 돌리려고 같은 묶음을 두 번 깔고 -50%까지 이동시킨다. 두 번째 묶음은 스크린리더가
 * 두 번 읽지 않도록 aria-hidden 이다. 마우스를 올리면 멈춘다.
 *
 * 처음 받는 중 · 실패 · 빈 응답은 흐르지 않는 한 줄로 이 띠 안에서만 알린다(구조 규칙 9).
 * 갱신이 실패하면 마지막 값을 그대로 흘린다.
 */
export default function PriceTicker() {
  const prices = useSourceMarketQuotes(TICKER_SOURCE);
  const items = prices.data;

  return (
    <section
      aria-label="코인 시세"
      className="flex h-11 items-stretch overflow-hidden border-2 border-brand bg-brand/5"
    >
      <div className="flex flex-none items-center gap-1.5 bg-brand px-3 text-xs font-semibold text-text-inverse">
        <span aria-hidden="true" className="size-1.5 bg-text-inverse" />
        LIVE
      </div>

      <div className="flex min-w-0 flex-1 items-center overflow-hidden">
        {items && items.length > 0 ? (
          <div
            className="flex h-full w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none"
            style={{ animationDuration: `${items.length * SECONDS_PER_CELL}s` }}
          >
            {renderGroup(items, false)}
            {renderGroup(items, true)}
          </div>
        ) : (
          <p className="px-4 text-sm text-text-muted">{statusText(items, prices.failure)}</p>
        )}

        {!items && prices.failure ? (
          <button
            type="button"
            className="flex-none px-2 text-sm font-semibold text-brand"
            onClick={prices.retry}
          >
            다시 시도
          </button>
        ) : null}
      </div>
    </section>
  );
}

function renderGroup(items: SymbolQuote[], hidden: boolean) {
  return (
    <ul className="flex h-full" aria-hidden={hidden || undefined}>
      {items.map(({ symbol, quote }) => {
        const direction = DIRECTION[directionOf(quote.changeRate)];
        return (
          <li
            key={symbol}
            className="flex h-full items-center gap-2 border-r border-brand-soft px-4 text-sm whitespace-nowrap tabular-nums"
          >
            <span className="font-semibold text-brand">{symbol}</span>
            <span className="text-text-primary">{formatCoinKrw(quote.price)}</span>
            {quote.changeRate !== null ? (
              <span className={direction.color}>
                <span aria-hidden="true">{direction.arrow} </span>
                <span className="sr-only">{direction.label} </span>
                {formatChangeRate(quote.changeRate, { signed: false })}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function statusText(
  items: SymbolQuote[] | undefined,
  failure: "rate-limited" | "error" | null,
): string {
  if (items) return "지금 보여 줄 시세가 없습니다.";
  if (failure === "rate-limited") return "시세 요청이 많아 잠시 후 다시 불러옵니다.";
  if (failure === "error") return "시세를 불러오지 못했습니다.";
  // 서버 렌더와 첫 요청 전에도 여기다. 쿼리가 아직 안 돌아 loading 이 false 일 수 있다.
  return "시세를 불러오는 중…";
}

/** 소수 첫째 자리에서 0 이면 보합. `formatChangeRate` 와 같은 기준이다. */
function directionOf(change: number | null): keyof typeof DIRECTION {
  if (change === null || Math.round(change * 10) === 0) return "flat";
  return change > 0 ? "up" : "down";
}
