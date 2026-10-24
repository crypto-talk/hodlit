"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PostCard from "@/components/post/post-card";
import { Button } from "@/components/ui/button";
import { roomHref, writeHref } from "@/lib/routes";
import { loadRoomPostPage } from "../api";
import RoomPagination from "./room-pagination";

export type RoomTab = "all" | "verified";

type Props = {
  symbol: string;
  tab: RoomTab;
  /** 지금 쪽. 1부터. */
  page: number;
  /** 이 방이 보유 인증을 지원하는지. 미지원 방의 인증 탭은 늘 비어 있으므로 문구가 다르다. */
  verifiable: boolean;
};

const TAB_CLASS =
  "border-b-2 border-transparent py-2 text-body font-semibold text-text-muted hover:text-text-primary";
const TAB_ACTIVE = "border-b-brand text-text-primary";

/**
 * 방 글 목록 — 전체 / 인증 2탭 (G 군).
 *
 * 탭과 쪽은 쿼리스트링이다(구조 규칙 8). 새로고침하거나 링크를 보내도 같은 화면이 열린다.
 * 탭을 바꾸면 1쪽으로 돌아간다(탭 링크에 쪽을 싣지 않는다).
 *
 * 번호 페이지 목록(HODL-66)을 쓴다. 인증 탭은 서버가 거르고 총수도 그 기준이다.
 * 쪽을 넘길 때 새 쪽이 올 때까지 이전 쪽을 흐리게 남겨 둔다 — 목록이 비었다가 차면서
 * 화면이 위아래로 튀지 않게.
 */
export default function RoomPosts({ symbol, tab, page, verifiable }: Props) {
  const posts = useQuery({
    queryKey: ["room-posts", symbol, tab, page],
    queryFn: () => loadRoomPostPage(symbol, tab, page),
    placeholderData: keepPreviousData,
  });

  const visible = posts.data?.posts ?? [];
  const totalPages = posts.data?.totalPages ?? 0;
  const pastEnd = posts.isSuccess && visible.length === 0 && totalPages > 0;

  return (
    <section id="room-posts" aria-label="글 목록" className="scroll-mt-8">
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
        <div
          className={`mt-4 flex flex-col gap-2 transition-opacity ${
            posts.isPlaceholderData ? "opacity-60" : ""
          }`}
          aria-busy={posts.isPlaceholderData}
        >
          {visible.map((post) => (
            <PostCard key={post.id} post={post} showRoom={false} />
          ))}

          {pastEnd ? (
            <p className="px-4 py-12 text-center text-text-muted">
              이 쪽에는 글이 없습니다.{" "}
              <Link
                href={roomHref(symbol, tab === "verified" ? "verified" : undefined)}
                className="font-semibold text-brand"
              >
                첫 쪽으로
              </Link>
            </p>
          ) : null}

          {visible.length === 0 && !pastEnd ? (
            <EmptyState symbol={symbol} tab={tab} page={page} verifiable={verifiable} />
          ) : null}

          <RoomPagination symbol={symbol} tab={tab} page={page} totalPages={totalPages} />
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
          ? "보유 인증된 글이 아직 없습니다."
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
