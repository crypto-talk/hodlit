"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useRequireLogin, useSession } from "@/lib/session";
import { WalletLinkCancelled } from "@/lib/wallet-link";

/**
 * 지갑 연결 버튼의 동작. 셸 사이드바와 마이페이지 "지갑 추가" 가 같이 쓴다.
 *
 * - 로그인 전이면 `/login` 으로 보낸다. 돌아오면 다시 누르면 된다
 * - 성공하면 지갑 목록(`["wallets"]`)을 다시 받는다
 * - 실패 · 취소 문구는 `lib/wallet-link.ts` 가 만든다. 취소는 사용자가 고른 것이라
 *   빨간 오류가 아니라 일반 토스트로 띄운다
 */
export function useConnectWallet() {
  const { connectWallet } = useSession();
  const requireLogin = useRequireLogin();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (requireLogin()) return;
    setConnecting(true);
    try {
      await connectWallet();
      await queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("지갑을 연결했습니다.");
    } catch (reason) {
      if (reason instanceof WalletLinkCancelled) toast(reason.message);
      else toast.error(reason instanceof Error ? reason.message : "지갑 연결에 실패했습니다.");
    } finally {
      setConnecting(false);
    }
  }, [connectWallet, queryClient, requireLogin]);

  return { connect, connecting };
}
