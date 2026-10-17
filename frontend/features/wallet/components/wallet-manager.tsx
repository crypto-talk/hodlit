"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectExchange, disconnectWallet } from "../api";
import { useConnectWallet } from "../hooks/use-connect-wallet";
import { useExchanges, useWallets } from "../hooks/use-wallets";
import ConnectionRow from "./connection-row";

const SECTION = "rounded-lg border border-border-subtle bg-surface p-5";

/**
 * 마이페이지 지갑 탭 (HODL-74): 지갑 추가 · 해제, 거래소 연결 해제.
 *
 * 거래소를 새로 연결하거나 다시 연결하는 화면은 아직 없다(API 키 입력이 필요하다). 그래서
 * 거래소는 목록과 해제만 있다. 계정 확인값이 없는 예전 연결이 남아 있으면 모든 코인 조회가
 * 불완전으로 남는데, 그런 연결을 지울 방법이 지금은 여기뿐이다.
 *
 * 해제하면 서버가 내 자산 캐시를 비운다. 이미 쓴 글 · 댓글의 보유 기록은 발행 때 고정된
 * 것이라 바뀌지 않는다.
 */
export default function WalletManager() {
  const queryClient = useQueryClient();
  const wallets = useWallets();
  const exchanges = useExchanges();
  const { connect, connecting } = useConnectWallet();

  const removeWallet = useMutation({
    mutationFn: disconnectWallet,
    onSuccess: () => {
      toast.success("지갑 연결을 해제했습니다.");
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
    onError: (error) => toast.error(error.message || "지갑 연결을 해제하지 못했습니다."),
  });

  const removeExchange = useMutation({
    mutationFn: disconnectExchange,
    onSuccess: () => {
      toast.success("거래소 연결을 해제했습니다.");
      void queryClient.invalidateQueries({ queryKey: ["exchanges"] });
    },
    onError: (error) => toast.error(error.message || "거래소 연결을 해제하지 못했습니다."),
  });

  const walletList = wallets.data ?? [];
  const exchangeList = exchanges.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="wallets-title" className={SECTION}>
        <div className="flex items-baseline gap-2">
          <h2 id="wallets-title" className="flex-1 text-body font-semibold">
            연결된 지갑
          </h2>
          {wallets.data ? (
            <span className="text-xs text-text-muted tabular-nums">{walletList.length}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          주소는 앞뒤만 보입니다. 여러 지갑을 연결하면 보유량을 합산합니다.
        </p>

        {wallets.isPending ? (
          <p className="mt-4 text-sm text-text-muted">불러오는 중…</p>
        ) : wallets.isError ? (
          <Retry onRetry={() => wallets.refetch()} />
        ) : walletList.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">연결된 지갑이 없습니다.</p>
        ) : (
          <ul aria-label="연결된 지갑" className="mt-2 flex flex-col">
            {walletList.map((wallet) => (
              <ConnectionRow
                key={wallet.id}
                label={wallet.shortAddress}
                connectedOn={wallet.connectedOn}
                target="이 지갑 연결"
                pending={removeWallet.isPending && removeWallet.variables === wallet.id}
                onDisconnect={() => removeWallet.mutate(wallet.id)}
              />
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant={walletList.length > 0 ? "secondary" : "primary"}
          className="mt-4"
          disabled={connecting}
          onClick={connect}
        >
          {connecting ? "지갑 확인 중…" : walletList.length > 0 ? "지갑 추가" : "지갑 연결"}
        </Button>
        {walletList.length > 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            지갑 창에서 다른 지갑이나 계정을 고르면 추가됩니다.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="exchanges-title" className={SECTION}>
        <div className="flex items-baseline gap-2">
          <h2 id="exchanges-title" className="flex-1 text-body font-semibold">
            연결된 거래소
          </h2>
          {exchanges.data ? (
            <span className="text-xs text-text-muted tabular-nums">{exchangeList.length}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          거래소 연결은 준비 중입니다. 지금은 해제만 할 수 있습니다.
        </p>

        {exchanges.isPending ? (
          <p className="mt-4 text-sm text-text-muted">불러오는 중…</p>
        ) : exchanges.isError ? (
          <Retry onRetry={() => exchanges.refetch()} />
        ) : exchangeList.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">연결된 거래소가 없습니다.</p>
        ) : (
          <ul aria-label="연결된 거래소" className="mt-2 flex flex-col">
            {exchangeList.map((exchange) => (
              <ConnectionRow
                key={exchange.code}
                label={exchange.name}
                connectedOn={exchange.connectedOn}
                target={`${exchange.name} 연결`}
                pending={removeExchange.isPending && removeExchange.variables === exchange.code}
                onDisconnect={() => removeExchange.mutate(exchange.code)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="mt-4 text-sm text-text-muted">
      불러오지 못했습니다.{" "}
      <button type="button" className="font-semibold text-brand" onClick={onRetry}>
        다시 시도
      </button>
    </p>
  );
}
