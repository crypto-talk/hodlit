"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import RoomClosed from "@/components/room-closed";
import { Button } from "@/components/ui/button";
import { UNSUPPORTED_LABEL } from "@/lib/holder-snapshot/label";
import { ApiError } from "@/lib/http";
import { writeHref } from "@/lib/routes";
import { loadRoom } from "../api";
import type { RoomInfo } from "../types";
import RoomChart from "./room-chart";
import RoomPosts, { type RoomTab } from "./room-posts";
import RoomPrice from "./room-price";

type Props = {
  symbol: string;
  tab: RoomTab;
  /** 글 목록 쪽. 1부터. */
  page: number;
  /**
   * 투표 칸. features 끼리는 서로 부르지 않으므로(구조 규칙 1) 페이지가 `features/vote` 의 칸을 넣어 준다.
   * 방이 확인된 뒤에만 그린다.
   */
  poll: React.ReactNode;
  /** 뉴스 칸. 투표 칸과 같은 이유로 페이지가 `features/news` 의 칸을 넣어 준다. */
  news: React.ReactNode;
};

/**
 * 방 게시판 `/subhodl/[symbol]`.
 *
 * 구조 결정 G 군: 위에 [코인·시세 + 차트], 그 아래 [뉴스 | 투표] 2분할(HODL-62 · 64), 그 아래 전체/인증
 * 2탭 글 목록.
 *
 * 데이터는 클라이언트에서 가져온다. 글 상세와 같은 이유로, access 토큰이 쿠키로
 * 옮겨지기 전(B-3)에는 서버가 로그인 상태를 알 수 없다. 방 정보를 먼저 받고,
 * 있는 방일 때만 시세 · 차트와 글을 받는다. 없는 방(404)에 요청을 두 번 더 보내지 않으려고
 * 왕복 한 번을 감수했다.
 *
 * 아직 없는 것
 *   - 인증 참여자 비율: 방 통계 API(`/communities/{symbol}/stats`)가 생겼다. 아직 붙이지 않았다
 *   - 평균 보유 기간: `holdingMonths` 가 아직 전부 null 이다
 */
export default function RoomBoard({ symbol, tab, page, poll, news }: Props) {
  const room = useQuery({ queryKey: ["room", symbol], queryFn: () => loadRoom(symbol) });

  if (room.isError) {
    const missing = room.error instanceof ApiError && room.error.status === 404;
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
        <p className="text-body font-semibold">
          {missing ? `${symbol} 방을 찾을 수 없습니다.` : "방을 불러오지 못했습니다."}
        </p>
        {missing ? (
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand">
            홈으로
          </Link>
        ) : (
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-brand"
            onClick={() => room.refetch()}
          >
            다시 시도
          </button>
        )}
      </div>
    );
  }

  if (room.isPending) {
    return <p className="text-sm text-text-muted">불러오는 중…</p>;
  }

  const info = room.data;
  if (info.operationStatus === "CLOSE") return <RoomClosed symbol={symbol} />;

  return (
    <div
      className="flex flex-col gap-8"
      // 방 강조색은 런타임 값이라 CSS 변수로 덮어쓴다(구조 규칙 7).
      style={
        info.accentColor
          ? ({ "--room-accent": info.accentColor } as React.CSSProperties)
          : undefined
      }
    >
      <RoomHeader info={info} />

      <div className="flex flex-col gap-4">
        <RoomPrice symbol={info.symbol} name={info.name} />
        <RoomChart symbol={info.symbol} name={info.name} />
      </div>

      <div className="grid grid-cols-2 gap-4 max-shell:grid-cols-1">
        {news}
        {poll}
      </div>

      <RoomPosts symbol={info.symbol} tab={tab} page={page} verifiable={info.verifiable} />
    </div>
  );
}

function RoomHeader({ info }: { info: RoomInfo }) {
  const count = `글 ${info.postCount.toLocaleString("ko-KR")}개`;

  return (
    <header className="flex flex-wrap items-end gap-x-4 gap-y-2 border-l-4 border-l-room-accent pl-4">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-h1 font-semibold text-text-primary">{info.symbol}</span>
          <span className="text-body text-text-muted">{info.name} 방</span>
        </h1>
        <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-muted">
          <span>{count}</span>
          {info.verifiable ? null : <span>· {UNSUPPORTED_LABEL}</span>}
        </p>
      </div>
      <span className="flex-1" />
      {/* 좁은 화면에서는 FAB 이 같은 일을 한다. */}
      <Button asChild variant="primary" className="max-shell:hidden">
        <Link href={writeHref(info.symbol)}>이 방에 글쓰기</Link>
      </Button>
    </header>
  );
}
