"use client";

import { formatChangeRate, formatCoinKrw } from "@/lib/format/number";
import { formatClock } from "@/lib/format/time";
import { useMarketQuote } from "@/lib/market-price/use-market-price";
import { cn } from "@/lib/utils";

type Props = {
  symbol: string;
  name: string;
};

const SOURCE_LABEL = {
  upbit: "업비트",
  coingecko: "CoinGecko",
} as const;

const BASIS_LABEL = {
  "prev-close": "전일 대비",
  "24h": "24시간",
} as const;

const DIRECTION_COLOR = {
  up: "text-success",
  down: "text-danger",
  flat: "text-text-muted",
} as const;

/**
 * 방 대문 위칸 — 코인 · 현재가 · 등락률.
 *
 * 브라우저가 직접 불러 30초마다 다시 받는다(HODL-61, `lib/market-price/`). 아래 차트와 숫자를
 * 맞추려고 업비트 원화 마켓이 있는 코인은 업비트 현재가(등락률은 전일 대비), 없는 코인
 * (BNB · LTC · TON)만 CoinGecko 원화 환산값(등락률은 24시간)이다. 출처와 기준을 칸에 적는다.
 * "몇 초 후 갱신" 카운트다운은 없앴다(HODL-63). 자동 갱신은 그대로다.
 * 다시 받는 동안에는 가격 줄만 흐리게 한다. 화면 전체를 덮지 않는다.
 *
 * 갱신이 실패해도 마지막 값을 그대로 두고 그 아래에 작게 알린다. 처음부터 못 받았을 때만
 * "다시 시도"를 둔다. 실패는 이 칸 안에서만 알린다(구조 규칙 9). 게시판은 그대로 읽힌다.
 */
export default function RoomPrice({ symbol, name }: Props) {
  const price = useMarketQuote(symbol);
  const quote = price.data;

  return (
    <section
      aria-label={`${symbol} 시세`}
      className="rounded-lg border border-border-subtle bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="text-sm font-semibold text-text-muted">{name} 시세</span>
        <span className="flex-1" />
        {quote ? (
          <span className="text-xs text-text-muted tabular-nums">
            {SOURCE_LABEL[quote.source]}
            {quote.updatedAt ? ` · ${formatClock(quote.updatedAt)} 기준` : ""}
          </span>
        ) : null}
      </div>

      {price.loading ? <p className="mt-2 text-sm text-text-muted">시세를 불러오는 중…</p> : null}

      {quote === undefined && !price.loading && price.failure ? (
        <p className="mt-2 text-sm text-text-muted">
          {price.failure === "rate-limited"
            ? "시세 요청이 많아 잠시 후 다시 불러옵니다."
            : "시세를 불러오지 못했습니다."}{" "}
          <button type="button" className="font-semibold text-brand" onClick={price.retry}>
            다시 시도
          </button>
        </p>
      ) : null}

      {quote === null ? (
        <p className="mt-2 text-sm text-text-muted">이 코인은 시세 정보가 없습니다.</p>
      ) : null}

      {quote ? (
        <div
          className={cn(
            "mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 transition-opacity duration-300",
            price.refreshing && "opacity-50",
          )}
          aria-busy={price.refreshing || undefined}
        >
          <span className="text-h1 font-semibold text-text-primary tabular-nums">
            {formatCoinKrw(quote.price)}
          </span>
          <span
            className={`text-body font-semibold tabular-nums ${DIRECTION_COLOR[directionOf(quote.changeRate)]}`}
          >
            {formatChangeRate(quote.changeRate)}
          </span>
          <span className="text-xs text-text-muted">{BASIS_LABEL[quote.changeBasis]}</span>
        </div>
      ) : null}

      {quote && price.failure ? (
        <p className="mt-1 text-xs text-text-muted">
          {price.failure === "rate-limited"
            ? "요청이 많아 잠시 쉬었다가 다시 갱신합니다. 마지막으로 받은 값입니다."
            : "갱신하지 못해 마지막으로 받은 값을 보여 줍니다."}
        </p>
      ) : null}
    </section>
  );
}

/** 소수 첫째 자리에서 0 이면 보합. `formatChangeRate` 와 같은 기준이다. */
function directionOf(change: number | null): keyof typeof DIRECTION_COLOR {
  if (change === null || Math.round(change * 10) === 0) return "flat";
  return change > 0 ? "up" : "down";
}
