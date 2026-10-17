"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { exchangesQueryKey, loadExchanges, loadWallets, walletsQueryKey } from "../api";

/**
 * 연결된 지갑 목록. 셸 사이드바와 마이페이지가 같은 키를 써서, 한쪽에서 추가 · 해제하면
 * 다른 쪽도 다시 받는다.
 *
 * 로그인 상태에서만 부른다. 로그아웃하면 키가 바뀌어 빈 목록으로 보인다.
 */
export function useWallets() {
  const { member } = useSession();
  const memberId = member?.id ?? null;

  return useQuery({
    queryKey: walletsQueryKey(memberId),
    queryFn: loadWallets,
    enabled: memberId !== null,
  });
}

/** 연결된 거래소 목록. 지금은 마이페이지만 쓴다. */
export function useExchanges() {
  const { member } = useSession();
  const memberId = member?.id ?? null;

  return useQuery({
    queryKey: exchangesQueryKey(memberId),
    queryFn: loadExchanges,
    enabled: memberId !== null,
  });
}
