import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Logo from "./logo";
import type { SidebarWallet } from "./types";

type Props = {
  /** 연결된 지갑 목록. 로그인 전이거나 연결 전이면 빈 배열이다. */
  wallets: SidebarWallet[];
  onConnectWallet: () => void;
  className?: string;
};

/**
 * 지갑 카드. 연결 전이면 연결 안내, 연결 후면 지갑 목록과 "지갑 추가".
 *
 * 사이드바 안에 있던 것을 떼어 냈다. 넓은 화면(≥1320px)에서는 셸 레이아웃의
 * 오른쪽 칸에, 그보다 좁으면 왼쪽 사이드바에 그린다. 두 자리 모두 렌더하고
 * CSS 로 하나만 보인다 — 화면 폭을 JS 로 읽으면 첫 렌더에서 자리가 튄다.
 */
export default function WalletCard({ wallets, onConnectWallet, className }: Props) {
  const connected = wallets.length > 0;

  return (
    <div
      className={cn("rounded-lg border border-border-subtle bg-surface p-4 text-center", className)}
    >
      <div className="flex justify-center">
        <Logo size={56} background="var(--brand-soft)" foreground="var(--text-primary)" />
      </div>
      <div className="mt-4 text-h2 font-semibold">
        {connected ? "연결된 지갑" : "지갑을 연결하면"}
      </div>

      {connected ? (
        <div className="mt-2 flex flex-col gap-2 text-left">
          {wallets.map((wallet) => (
            <div key={wallet.id} className="flex items-baseline gap-2">
              {/* 주소는 앞뒤만 나온다. 축약은 features/wallet 에서 한다. */}
              <span
                className="min-w-0 flex-1 truncate text-sm tabular-nums"
                title="연결된 지갑 주소"
              >
                {wallet.shortAddress}
              </span>
              <span className="flex-none text-xs text-text-muted">{wallet.connectedOn}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2 text-left">
          {[
            "글에 보유 배지가 붙습니다",
            "보유 기간이 기록으로 쌓입니다",
            "내 코인 방이 고정됩니다",
          ].map((line) => (
            <div key={line} className="flex items-start gap-2">
              <span className="mt-2 size-1.5 flex-none rounded-full bg-brand" />
              <span className="text-sm text-text-muted">{line}</span>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant={connected ? "secondary" : "primary"}
        className="mt-4 w-full"
        onClick={onConnectWallet}
      >
        {connected ? "지갑 추가" : "지갑 연결"}
      </Button>
      <div className="mt-2 text-xs text-text-muted">
        {connected ? "지갑에서 다른 계정을 고르면 추가됩니다" : "연결 안 해도 읽고 쓸 수 있습니다"}
      </div>
    </div>
  );
}
