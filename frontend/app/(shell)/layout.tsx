"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Fab from "@/components/layout/fab";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import PriceTicker from "@/components/layout/price-ticker";
import Sidebar from "@/components/layout/sidebar";
import WalletBox from "@/components/layout/wallet-box";
import type { SidebarRoom } from "@/components/layout/types";
import { loadRooms } from "@/features/room/api";
import { useConnectWallet } from "@/features/wallet/hooks/use-connect-wallet";
import { useWallets } from "@/features/wallet/hooks/use-wallets";
import { roomSymbolOf, writeHref } from "@/lib/routes";

/**
 * 헤더 + 사이드바(≥900px) / 하단 탭(<900px) 화면군 (A-3).
 *
 * 랜딩이 지금 여기 있고, 방 게시판·글 상세·공개 프로필이 3단계에 들어온다.
 * 사이드바의 방 목록과 연결된 지갑은 화면이 아니라 셸의 것이라 페이지가 아니라
 * 여기서 가져온다. 3단계 화면들이 그대로 물려받는다.
 *
 * ⚠️ 이 레이아웃은 `"use client"` 다. access 토큰이 아직 sessionStorage 라
 * 서버에서 로그인 상태를 알 수 없고(B-3), 지갑 연결이 브라우저 확장을 부르기
 * 때문이다. access 가 쿠키로 옮겨지면 방 목록을 서버에서 가져오고 클라이언트
 * 부분만 잘라낼 수 있다.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  // 방 게시판·글 상세 안이면 그 방. 사이드바 표시와 FAB 글쓰기가 쓴다.
  const currentRoom = roomSymbolOf(usePathname());

  const [rooms, setRooms] = useState<SidebarRoom[]>([]);

  useEffect(() => {
    // 방 목록은 로그인과 무관하다. 실패해도 사이드바의 나머지는 떠야 한다.
    loadRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  /**
   * 연결된 지갑 목록. 로그인 상태에서만 부르고, 마이페이지와 같은 쿼리 키를 쓴다.
   *
   * member.walletAddress 하나로 판단하지 않는 이유는, 백엔드가 한 회원에 여러
   * 지갑을 붙일 수 있고 자산도 합산해서 계산하기 때문이다.
   */
  const wallets = useWallets();
  const { connect, connecting } = useConnectWallet();

  const sidebarRooms = rooms.map((room) => ({ ...room, current: room.symbol === currentRoom }));

  return (
    <div className="min-h-screen">
      <Header />

      {/*
       * 상단 시세 전광판(HODL-57). 랜딩만의 것이 아니라 화면군 전체에 걸리는 띠라
       * 레이아웃에 둔다.
       */}
      <PriceTicker />

      {/*
       * 세 칸: 사이드바(240) · 본문(최대 720) · 오른쪽 칸(240). 1320px 이상에서 본문이
       * 화면 정가운데에 온다(양옆 칸 폭이 같다).
       *
       * 본문이 화면 끝까지 늘어나면 한 줄이 너무 길어 읽기 힘들어 폭을 막았다.
       * 오른쪽 칸에는 예전 지갑 카드 자리의 빈 박스를 둔다. 지갑 연결은 사이드바 '내 코인'으로
       * 옮겼고, 박스는 회의 결정대로 내용만 비운 채 남긴다(HODL-58). 나중에 광고·보조 정보가
       * 들어갈 자리다. 임시로 두던 "북마크한 글" 상자는 마이페이지 북마크 탭으로 옮겼다.
       * 1320px 미만에서는 오른쪽 칸이 숨고 빈 박스는 사이드바로 돌아간다.
       * 900px 미만에서는 사이드바도 숨는다.
       */}
      <div className="mx-auto flex max-w-[1320px] items-start gap-8 px-6 pt-8 pb-12">
        <Sidebar
          rooms={sidebarRooms}
          wallets={wallets.data ?? []}
          onConnectWallet={connect}
          connecting={connecting}
        />

        <div className="flex min-w-0 flex-[0_1_720px] flex-col gap-12 max-shell:flex-1">
          {children}
        </div>

        <aside aria-label="내 정보" className="hidden w-60 flex-none flex-col gap-4 wide:flex">
          <WalletBox />
        </aside>
      </div>

      <Footer />
      <Fab href={writeHref(currentRoom)} />
    </div>
  );
}
