import Link from "next/link";
import { roomHref } from "@/lib/routes";
import MyCoins from "./my-coins";
import WalletBox from "./wallet-box";
import type { SidebarRoom, SidebarWallet } from "./types";

type Props = {
  rooms: SidebarRoom[];
  /** 연결된 지갑 목록. 로그인 전이거나 연결 전이면 빈 배열이다. */
  wallets: SidebarWallet[];
  onConnectWallet: () => void;
  /** 지갑 연결이 진행 중이면 true. */
  connecting: boolean;
};

/** 섹션 제목. 사이드바 안에서만 쓰는 작은 조각이라 여기 둔다. */
const LABEL = "text-xs font-semibold tracking-[0.06em] text-text-muted";

export default function Sidebar({ rooms, wallets, onConnectWallet, connecting }: Props) {
  return (
    <div className="flex w-60 flex-none flex-col max-shell:hidden">
      <div className={LABEL}>내 코인</div>
      <MyCoins wallets={wallets} onConnectWallet={onConnectWallet} connecting={connecting} />

      {/*
       * 등락률은 뺐다(HODL-59). 10-08 회의: 다른 것으로 채울 게 아니면 아예 없앤다.
       * 시세는 방 게시판 안에서 본다.
       */}
      <div className={`${LABEL} mt-8`}>전체 방</div>

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
          </Link>
        ))}
      </div>

      {/* 넓은 화면(≥1320px)에서는 오른쪽 칸으로 옮겨 가고 여기서는 숨는다. */}
      <WalletBox className="mt-8 wide:hidden" />

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
