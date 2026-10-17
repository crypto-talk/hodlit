"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { canUseWalletConnect, hasInjectedWallet, type WalletMethod } from "@/lib/wallet-link";
import type { SidebarWallet } from "./types";

type Props = {
  /** 연결된 지갑 목록. 로그인 전이거나 연결 전이면 빈 배열이다. */
  wallets: SidebarWallet[];
  onConnectWallet: (method: WalletMethod) => void;
  /** 연결이 진행 중이면 true. 그동안 버튼을 잠근다. */
  connecting: boolean;
};

/**
 * 사이드바 '내 코인' 칸. 지갑 연결 버튼과 연결된 지갑 목록이 여기 있다 (HODL-58).
 *
 * 예전에는 따로 떨어진 지갑 카드가 넓은 화면에선 오른쪽 칸, 좁은 화면에선 사이드바 아래에
 * 있었다. 10-08 회의에서 "내 코인에 지갑 연결 버튼을 넣고 기존 지갑 연결 박스는 비운다"로
 * 정해 여기로 합쳤다. 지갑을 연결해야 내 코인 방이 고정되므로 버튼이 그 설명 바로 아래에 온다.
 *
 * 연결 방법은 둘이다 (HODL-55).
 *   - 브라우저 확장 지갑이 없으면 누르자마자 QR · 모바일 지갑(WalletConnect)으로 간다
 *   - 확장이 있으면 둘 중 고르게 한다. 확장이 있어도 휴대폰 지갑을 쓰고 싶을 수 있다
 * 확장 여부는 누르는 순간에 본다. 렌더 때 `window` 를 읽으면 서버 렌더와 어긋난다.
 *
 * 보유 코인의 방을 실제로 고정하는 것은 아직 없다. `/me/assets` 를 부르면 서버가 잔액을 새로
 * 조회하므로(최대 15초) 셸이 화면마다 부르기엔 무겁다. 마이페이지와 함께 정한다.
 */
export default function MyCoins({ wallets, onConnectWallet, connecting }: Props) {
  const connected = wallets.length > 0;
  const [choosing, setChoosing] = useState(false);

  const start = () => {
    if (hasInjectedWallet()) {
      setChoosing((open) => !open);
      return;
    }
    onConnectWallet("walletconnect");
  };

  const pick = (method: WalletMethod) => {
    setChoosing(false);
    onConnectWallet(method);
  };

  return (
    <div className="mt-2 rounded-lg border border-border-subtle bg-surface p-4">
      <p className="text-sm text-text-muted">
        {connected
          ? "보유 중인 코인의 방이 여기 고정됩니다"
          : "지갑을 연결하면 보유 중인 코인의 방이 여기 고정됩니다"}
      </p>

      {connected ? (
        <ul aria-label="연결된 지갑" className="mt-4 flex flex-col gap-2">
          {wallets.map((wallet) => (
            <li key={wallet.id} className="flex items-baseline gap-2">
              {/* 주소는 앞뒤만 나온다. 축약은 features/wallet 에서 한다. */}
              <span className="min-w-0 flex-1 truncate text-sm tabular-nums">
                {wallet.shortAddress}
              </span>
              <span className="flex-none text-xs text-text-muted">{wallet.connectedOn}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant={connected ? "secondary" : "primary"}
        className="mt-4 w-full"
        aria-expanded={choosing}
        disabled={connecting}
        onClick={start}
      >
        {connecting ? "지갑 확인 중…" : connected ? "지갑 추가" : "지갑 연결"}
      </Button>

      {choosing && !connecting ? (
        <div role="group" aria-label="연결 방법" className="mt-2 flex flex-col gap-2">
          <Button type="button" className="w-full" onClick={() => pick("injected")}>
            브라우저 확장 지갑
          </Button>
          <Button
            type="button"
            className="w-full"
            disabled={!canUseWalletConnect()}
            onClick={() => pick("walletconnect")}
          >
            QR · 모바일 지갑
          </Button>
        </div>
      ) : null}

      <p className="mt-2 text-center text-xs text-text-muted">
        {connected ? "다른 지갑이나 계정을 고르면 추가됩니다" : "연결 안 해도 읽고 쓸 수 있습니다"}
      </p>
    </div>
  );
}
