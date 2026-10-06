"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UNSUPPORTED_LABEL } from "@/lib/holder-snapshot/label";
import { ApiError } from "@/lib/http";
import { writeHref } from "@/lib/routes";
import { loadRoom } from "../api";
import type { RoomInfo } from "../types";
import RoomPosts, { type RoomTab } from "./room-posts";
import RoomPrice from "./room-price";

type Props = {
  symbol: string;
  tab: RoomTab;
};

/**
 * 방 게시판 `/subhodl/[symbol]`.
 *
 * 구조 결정 G 군: 위에 [코인·시세], 그 아래 [뉴스 | 투표] 2분할, 그 아래 전체/인증
 * 2탭 글 목록.
 *
 * 데이터는 클라이언트에서 가져온다. 글 상세와 같은 이유로, access 토큰이 쿠키로
 * 옮겨지기 전(B-3)에는 서버가 로그인 상태를 알 수 없다. 방 정보를 먼저 받고,
 * 있는 방일 때만 시세와 글을 받는다. 없는 방(404)에 요청을 두 번 더 보내지 않으려고
 * 왕복 한 번을 감수했다.
 *
 * 아직 없는 것
 *   - 뉴스 · 투표: 백엔드 API 가 없다. 그럴듯한 목값 대신 "준비 중"을 둔다(G-5)
 *   - 가격 차트: 과거 시세 API 가 없다
 *   - 더보기: 방 글 목록에 커서가 없다
 *   - 인증 사용자 수 · 평균 보유 기간: 집계 API 가 없다
 */
export default function RoomBoard({ symbol, tab }: Props) {
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

      <RoomPrice symbol={info.symbol} name={info.name} />

      <div className="grid grid-cols-2 gap-4 max-shell:grid-cols-1">
        <ComingSoon title="뉴스" body={`${info.name} 관련 뉴스를 모아 보여줄 자리입니다.`} />
        <ComingSoon
          title="투표"
          body="내일 오를지 내릴지 투표하고, 보유자와 전체의 생각을 나눠 볼 수 있게 됩니다."
        />
      </div>

      <RoomPosts symbol={info.symbol} tab={tab} verifiable={info.verifiable} />
    </div>
  );
}

function RoomHeader({ info }: { info: RoomInfo }) {
  const count = info.postCountCapped
    ? `글 ${info.postCount}개 이상`
    : `글 ${info.postCount.toLocaleString("ko-KR")}개`;

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

function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-dashed border-border-subtle bg-surface p-4"
    >
      <div className="flex items-baseline gap-2">
        <h2 className="text-body font-semibold text-text-primary">{title}</h2>
        <span className="rounded-sm border border-border-subtle px-2 py-0.5 text-xs text-text-muted">
          준비 중
        </span>
      </div>
      <p className="mt-2 text-sm text-text-muted">{body}</p>
    </section>
  );
}
