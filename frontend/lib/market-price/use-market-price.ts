import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { fetchGeckoQuotes } from "./coingecko";
import { marketCoinOf } from "./coins";
import { type MarketQuote, type MarketQuotes, PriceRateLimited, type QuoteSource } from "./quote";
import { fetchUpbitQuotes } from "./upbit";

/**
 * 시세 갱신 주기. 30초.
 *
 * Jira 요구는 5초였다. 처음 출처였던 CoinGecko 키 없는 API 는 값이 약 60초마다 바뀌고 한도가
 * IP당 분당 약 10~30회라 30초로 했다(HODL-61 코멘트). 업비트로 바꾼 뒤에도 그대로 둔다 —
 * 업비트는 브라우저 요청(Origin 헤더)을 10초당 1회로 제한하고 넘기면 일시 차단한다.
 */
export const MARKET_PRICE_REFRESH_MS = 30_000;

/** 429 · 418 을 받으면 이만큼 쉬었다가 다시 부른다. */
const RATE_LIMITED_WAIT_MS = 60_000;

/**
 * 출처마다 쿼리 하나. 업비트에 원화 마켓이 있는 코인은 업비트, 없는 코인(BNB · LTC · TON)은
 * CoinGecko 다. 각 쿼리는 그 출처의 코인을 한 요청에 묶어 받고, 방 시세 칸과 랜딩 티커가
 * 같은 키를 나눠 쓴다 — 동시에 마운트돼도 TanStack Query 가 요청 하나로 합친다.
 * 출처를 나눠 두면 한쪽이 실패해도 다른 쪽 코인은 그대로 보인다.
 */
const FETCHERS: Record<QuoteSource, (signal?: AbortSignal) => Promise<MarketQuotes>> = {
  upbit: fetchUpbitQuotes,
  coingecko: fetchGeckoQuotes,
};

export type MarketPriceState<T> = {
  /** 마지막으로 받은 값. 실패해도 이전 값을 그대로 둔다. */
  data: T | undefined;
  /** 아직 한 번도 못 받았고 받는 중. */
  loading: boolean;
  /** 마지막 시도가 실패했으면 그 이유. 성공하면 null. */
  failure: "rate-limited" | "error" | null;
  /** 이미 값이 있고 다시 받는 중. 가격 칸만 딤 처리하는 데 쓴다. */
  refreshing: boolean;
  retry: () => void;
};

/**
 * 한 출처의 시세를 주기적으로 받는다.
 *
 * - 30초마다 다시 받는다. 탭이 안 보이면 멈추고(`refetchIntervalInBackground` 기본값 false),
 *   이 훅을 쓰는 화면이 모두 사라지면 타이머도 사라진다
 * - 한 화면에 여러 곳이 써도 출처마다 요청은 하나다(같은 키, `staleTime` = 주기)
 * - 429 · 418 은 재시도하지 않고 60초 쉰다. 다른 실패는 한 번만 재시도한다
 */
function useSourceQuotes<T>(
  source: QuoteSource,
  select: (quotes: MarketQuotes) => T,
  enabled = true,
): UseQueryResult<T> {
  return useQuery({
    queryKey: ["market-quotes", source],
    queryFn: ({ signal }) => FETCHERS[source](signal),
    select,
    enabled,
    staleTime: MARKET_PRICE_REFRESH_MS,
    refetchInterval: (current) =>
      current.state.error instanceof PriceRateLimited
        ? RATE_LIMITED_WAIT_MS
        : MARKET_PRICE_REFRESH_MS,
    retry: (count, error) => !(error instanceof PriceRateLimited) && count < 1,
  });
}

function toState<T>(query: UseQueryResult<T>): MarketPriceState<T> {
  const hasData = query.data !== undefined;
  const failure = query.isError
    ? query.error instanceof PriceRateLimited
      ? "rate-limited"
      : "error"
    : null;

  return {
    data: query.data,
    loading: !hasData && query.isFetching,
    failure,
    refreshing: hasData && query.isFetching,
    retry: () => {
      void query.refetch();
    },
  };
}

const NO_QUOTE: MarketPriceState<null> = {
  data: null,
  loading: false,
  failure: null,
  refreshing: false,
  retry: () => {},
};

/**
 * 코인 하나의 시세. 표에 없는 코인이면 요청하지 않고 `data` 가 null 이다.
 * 응답에 그 코인이 없어도 null 이다.
 */
export function useMarketQuote(symbol: string): MarketPriceState<MarketQuote | null> {
  const key = symbol.toUpperCase();
  const coin = marketCoinOf(key);
  const source: QuoteSource = coin?.upbitMarket ? "upbit" : "coingecko";
  const select = useCallback((quotes: MarketQuotes) => quotes[key] ?? null, [key]);
  const state = toState(useSourceQuotes(source, select, coin !== null));

  return coin ? state : NO_QUOTE;
}
