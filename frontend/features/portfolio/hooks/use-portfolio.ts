"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { loadPortfolio, portfolioQueryKey } from "../api";

/**
 * 내 자산 포트폴리오. 로그인 상태에서만 부른다.
 *
 * 요청마다 서버가 지갑 · 거래소 잔액을 다시 읽어 최대 15초가 걸린다. 그래서 실패해도
 * 자동으로 한 번 더 부르지 않고(retry: false), 화면의 "다시 불러오기"에 맡긴다.
 */
export function usePortfolio() {
  const { member } = useSession();
  const memberId = member?.id ?? null;

  return useQuery({
    queryKey: portfolioQueryKey(memberId),
    queryFn: loadPortfolio,
    enabled: memberId !== null,
    retry: false,
  });
}
