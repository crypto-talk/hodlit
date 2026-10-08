import Link from "next/link";
import type { ReactNode } from "react";
import { roomHref } from "@/lib/routes";
import WalletCard from "./wallet-card";
import type { SidebarRoom, SidebarWallet } from "./types";

type Props = {
  rooms: SidebarRoom[];
  /** 연결된 지갑 목록. 로그인 전이거나 연결 전이면 빈 배열이다. */
  wallets: SidebarWallet[];
  onConnectWallet: () => void;
  /**
   * 지갑 카드 아래에 붙는 칸. 지금은 "북마크한 글"(임시)이다. 지갑 카드처럼 넓은
   * 화면에서는 오른쪽 칸에 그려지고 여기서는 숨는다.
   *
   * `components/` 는 `features/` 를 참조할 수 없어서(구조 규칙 1) 셸 레이아웃이
   * 만들어 넘긴다.
   */
  extra?: ReactNode;
};

const changeColor = (change: string) => {
  if (change.startsWith("-")) return "var(--danger)";
  if (change.startsWith("+")) return "var(--success)";
  return "var(--text-muted)";
};

/** 섹션 제목. 사이드바 안에서만 쓰는 작은 조각이라 여기 둔다. */
const LABEL = "text-xs font-semibold tracking-[0.06em] text-text-muted";
const CARD = "rounded-lg border border-border-subtle bg-surface p-4";

export default function Sidebar({ rooms, wallets, onConnectWallet, extra }: Props) {
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

      {/* 넓은 화면(≥1320px)에서는 오른쪽 칸으로 옮겨 가고 여기서는 숨는다. */}
      <WalletCard
        wallets={wallets}
        onConnectWallet={onConnectWallet}
        className="mt-8 wide:hidden"
      />
      {extra ? <div className="mt-4 wide:hidden">{extra}</div> : null}

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
