import Link from "next/link";
import { Button } from "@/components/ui/button";
import { roomHref } from "@/lib/routes";
import Logo from "./logo";
import type { SidebarRoom, SidebarWallet } from "./types";

type Props = {
  rooms: SidebarRoom[];
  /** 연결된 지갑 목록. 로그인 전이거나 연결 전이면 빈 배열이다. */
  wallets: SidebarWallet[];
  onConnectWallet: () => void;
};

const changeColor = (change: string) => {
  if (change.startsWith("-")) return "var(--danger)";
  if (change.startsWith("+")) return "var(--success)";
  return "var(--text-muted)";
};

/** 섹션 제목. 사이드바 안에서만 쓰는 작은 조각이라 여기 둔다. */
const LABEL = "text-xs font-semibold tracking-[0.06em] text-text-muted";
const CARD = "rounded-lg border border-border-subtle bg-surface p-4";

export default function Sidebar({ rooms, wallets, onConnectWallet }: Props) {
  const connected = wallets.length > 0;

  return (
    <div className="flex w-60 flex-none flex-col max-shell:hidden">
      <div className={LABEL}>내 코인</div>
      <div className={`${CARD} mt-2 text-sm text-text-muted`}>
        {connected
          ? "보유 중인 코인의 방이 여기 고정됩니다"
          : "지갑을 연결하면 보유 중인 코인의 방이 여기 고정됩니다"}
      </div>

      <div className="mt-8 flex items-baseline gap-2">
        <div className={`${LABEL} flex-1`}>전체 방</div>
        <div className="text-xs text-text-muted">24h</div>
      </div>

      <div className="mt-2 flex flex-col">
        {rooms.map((room) => (
          <Link
            key={room.symbol}
            href={roomHref(room.symbol)}
            aria-current={room.current ? "page" : undefined}
            className={`flex items-baseline gap-2 border-l-2 p-2 hover:bg-surface ${
              room.current ? "border-l-brand" : "border-l-transparent"
            }`}
          >
            <span className="flex-none text-sm font-semibold">{room.symbol}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{room.name}</span>
            <span
              className="flex-none text-sm tabular-nums"
              style={{ color: changeColor(room.change) }}
            >
              {room.change}
            </span>
          </Link>
        ))}
      </div>

      <div className={`${CARD} mt-8 text-center`}>
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
          {connected
            ? "지갑에서 다른 계정을 고르면 추가됩니다"
            : "연결 안 해도 읽고 쓸 수 있습니다"}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <a href="#" className="text-xs text-text-muted">
          커뮤니티 규칙
        </a>
        <a href="#" className="text-xs text-text-muted">
          의견 보내기
        </a>
        <a href="#" className="text-xs text-text-muted">
          광고 문의
        </a>
      </div>
    </div>
  );
}
