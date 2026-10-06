"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PostCard from "@/components/post/post-card";
import { Button } from "@/components/ui/button";
import { roomHref, writeHref } from "@/lib/routes";
import { ROOM_POST_LIMIT, loadRoomPosts } from "../api";

export type RoomTab = "all" | "verified";

type Props = {
  symbol: string;
  tab: RoomTab;
  /** 이 방이 보유 인증을 지원하는지. 미지원 방의 인증 탭은 늘 비어 있으므로 문구가 다르다. */
  verifiable: boolean;
};

const TAB_CLASS =
  "border-b-2 border-transparent py-2 text-body font-semibold text-text-muted hover:text-text-primary";
const TAB_ACTIVE = "border-b-brand text-text-primary";

/**
 * 방 글 목록 — 전체 / 인증 2탭 (G 군).
 *
 * 탭은 쿼리스트링이다(구조 규칙 8). 새로고침하거나 링크를 보내도 같은 탭이 열린다.
 * 탭 이동은 같은 데이터를 거르기만 하므로 다시 요청하지 않는다.
 *
 * ⚠️ 커서가 없어서 최신 `ROOM_POST_LIMIT` 개만 받는다. 인증 탭도 그 안에서
 * 거른 것이라 오래된 인증 글은 안 보일 수 있다. 백엔드에 커서와 인증 필터가
 * 생기면 서버에서 거른다.
 */
export default function RoomPosts({ symbol, tab, verifiable }: Props) {
  const posts = useQuery({
    queryKey: ["room-posts", symbol],
    queryFn: () => loadRoomPosts(symbol),
  });

  const all = posts.data ?? [];
  const visible = tab === "verified" ? all.filter((post) => post.tier !== "none") : all;
  const capped = all.length >= ROOM_POST_LIMIT;

  return (
    <section aria-label="글 목록">
      <nav className="flex gap-6 border-b border-border-subtle" aria-label="글 목록 탭">
        <Link
          href={roomHref(symbol)}
          scroll={false}
          aria-current={tab === "all" ? "page" : undefined}
          className={`${TAB_CLASS} ${tab === "all" ? TAB_ACTIVE : ""}`}
        >
          전체
        </Link>
        <Link
          href={roomHref(symbol, "verified")}
          scroll={false}
          aria-current={tab === "verified" ? "page" : undefined}
          className={`${TAB_CLASS} ${tab === "verified" ? TAB_ACTIVE : ""}`}
        >
          인증
        </Link>
        <span className="flex-1" />
        <span className="self-center text-xs text-text-muted">최신순</span>
      </nav>

      {posts.isPending ? <p className="mt-4 text-sm text-text-muted">글을 불러오는 중…</p> : null}

      {posts.isError ? (
        <div className="mt-4 rounded-lg border border-border-subtle bg-surface p-6 text-center">
          <p className="text-body font-semibold">글을 불러오지 못했습니다.</p>
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-brand"
            onClick={() => posts.refetch()}
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {posts.isSuccess ? (
        <div className="mt-4 flex flex-col gap-2">
          {visible.map((post) => (
            <PostCard key={post.id} post={post} showRoom={false} />
          ))}

          {visible.length === 0 ? (
            <EmptyState symbol={symbol} tab={tab} verifiable={verifiable} />
          ) : null}

          {capped ? (
            <p className="py-4 text-center text-xs text-text-muted">
              최신 {ROOM_POST_LIMIT}개까지만 보여줍니다. 이전 글 보기는 준비 중입니다.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({ symbol, tab, verifiable }: Props) {
  if (tab === "verified") {
    return (
      <p className="px-4 py-12 text-center text-text-muted">
        {verifiable
          ? "최근 글 중에 지갑 인증된 글이 없습니다."
          : `${symbol} 방은 아직 보유 인증을 지원하지 않아 인증된 글이 없습니다.`}
      </p>
    );
  }

  return (
    <div className="px-4 py-12 text-center">
      <p className="text-text-muted">아직 글이 없습니다. 이 방의 첫 글을 써 보세요.</p>
      <Button asChild variant="primary" className="mt-4">
        <Link href={writeHref(symbol)}>글쓰기</Link>
      </Button>
    </div>
  );
}
