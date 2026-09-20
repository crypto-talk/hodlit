"use client";

import { useCallback, useEffect, useState } from "react";
import Fab from "@/components/layout/fab";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import Sidebar from "@/components/layout/sidebar";
import type { SidebarRoom } from "@/components/layout/types";
import { marqueeItems } from "@/features/landing/api";
import Marquee from "@/features/landing/components/marquee";
import { loadRooms } from "@/features/room/api";
import { loadWallets, type ConnectedWallet } from "@/features/wallet/api";
import { useRequireLogin, useSession } from "@/lib/session";

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
  const { member, connectWallet } = useSession();
  const requireLogin = useRequireLogin();

  const [rooms, setRooms] = useState<SidebarRoom[]>([]);
  const [wallets, setWallets] = useState<ConnectedWallet[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // 방 목록은 로그인과 무관하다. 실패해도 사이드바의 나머지는 떠야 한다.
    loadRooms()
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  /**
   * 연결된 지갑 목록. 로그인 상태에서만 부를 수 있다.
   *
   * member.walletAddress 하나로 판단하지 않는 이유는, 백엔드가 한 회원에 여러
   * 지갑을 붙일 수 있고 자산도 합산해서 계산하기 때문이다.
   */
  useEffect(() => {
    // 로그아웃 때 비우려고 effect 안에서 바로 setState 하지 않는다. 아래
    // visibleWallets 가 member 로 걸러 주므로 남은 값이 화면에 새지 않는다.
    if (!member) return;

    let alive = true;
    loadWallets()
      .then((next) => {
        if (alive) setWallets(next);
      })
      .catch(() => {
        if (alive) setWallets([]);
      });
    return () => {
      alive = false;
    };
  }, [member]);

  const visibleWallets = member ? wallets : [];

  const onConnectWallet = useCallback(async () => {
    // 로그인 전이면 /login 으로 보낸다. 거기서 돌아오면 다시 누르면 된다.
    if (requireLogin()) return;
    setNotice("");
    try {
      // member 가 새 객체로 바뀌면 위 effect 가 지갑 목록을 다시 불러온다.
      await connectWallet();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "지갑 연결에 실패했습니다.");
    }
  }, [connectWallet, requireLogin]);

  return (
    <div className="hd min-h-screen">
      <Header />

      {/*
       * 상단 전광판. 숫자 세 개가 아직 목값이다(랜딩 집계 API 없음).
       * 랜딩만의 것이 아니라 화면군 전체에 걸리는 띠라 레이아웃에 둔다.
       */}
      <Marquee items={marqueeItems()} />

      <div className="flex items-start gap-8 px-6 pt-8 pb-12">
        <Sidebar rooms={rooms} wallets={visibleWallets} onConnectWallet={onConnectWallet} />

        <div className="flex min-w-0 flex-1 flex-col gap-12">
          {notice ? (
            <p role="alert" className="text-sm" style={{ color: "var(--hd-down)" }}>
              {notice}
            </p>
          ) : null}

          {children}
        </div>
      </div>

      <Footer />
      <Fab />
    </div>
  );
}
