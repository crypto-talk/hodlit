import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  fetchMarketQuotes,
  type MarketQuote,
  type MarketQuotes,
  PriceRateLimited,
} from "./coingecko";

/**
 * 시세 갱신 주기. 30초.
 *
 * Jira 요구는 5초였다. CoinGecko 키 없는 API 의 값은 약 60초마다 바뀌고, 응답에
 * `max-age=30` 이 붙으며, 한도가 IP당 분당 약 10~30회라 5초는 요청만 늘리고 429 위험이
 * 있다. 30초로 하고 HODL-61 에 근거를 남겼다(2026-10-18).
 */
export const MARKET_PRICE_REFRESH_MS = 30_000;

/** 429 를 받으면 이만큼 쉬었다가 다시 부른다. */
const RATE_LIMITED_WAIT_MS = 60_000;

/**
 * 시세 쿼리 키. 하나뿐이다 — 방 시세 칸과 랜딩 티커가 같은 요청을 나눠 쓴다.
 * 동시에 마운트돼도 TanStack Query 가 요청 하나로 합친다.
 */
const QUERY_KEY = ["market-quotes"] as const;

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
 * 시세를 주기적으로 받는다.
 *
 * - 30초마다 다시 받는다. 탭이 안 보이면 멈추고(`refetchIntervalInBackground` 기본값 false),
 *   이 훅을 쓰는 화면이 모두 사라지면 타이머도 사라진다
 * - 한 화면에 여러 곳이 써도 요청은 하나다(같은 키, `staleTime` = 주기)
 * - 429 는 재시도하지 않고 60초 쉰다. 다른 실패는 한 번만 재시도한다
 */
export function useMarketQuotes<T>(select: (quotes: MarketQuotes) => T): MarketPriceState<T> {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => fetchMarketQuotes(signal),
    select,
    staleTime: MARKET_PRICE_REFRESH_MS,
    refetchInterval: (current) =>
      current.state.error instanceof PriceRateLimited
        ? RATE_LIMITED_WAIT_MS
        : MARKET_PRICE_REFRESH_MS,
    retry: (count, error) => !(error instanceof PriceRateLimited) && count < 1,
  });

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

/** 코인 하나의 시세. 표에 없거나 응답에 없으면 `data` 가 null 이다. */
export function useMarketQuote(symbol: string): MarketPriceState<MarketQuote | null> {
  const key = symbol.toUpperCase();
  const select = useCallback((quotes: MarketQuotes) => quotes[key] ?? null, [key]);
  return useMarketQuotes(select);
}
