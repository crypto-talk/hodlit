"use client";

import { useQuery } from "@tanstack/react-query";
import PostCard from "@/components/post/post-card";
import { useSession } from "@/lib/session";
import { loadBookmarks } from "../api";

/**
 * 마이페이지 북마크 탭. 북마크한 순서(최근 먼저)로 전부 보인다 — 서버에 페이지가 없다.
 *
 * 카드는 랜딩 · 방 게시판과 같은 `PostCard` 다. 여러 방의 글이 섞이므로 방 칩을 켠다.
 * 글 상세에서 북마크를 누르면 `["bookmarks"]` 가 무효화돼 다시 받아 온다.
 *
 * 예전 오른쪽 칸의 임시 "북마크한 글" 상자는 이 탭이 생겨서 지웠다.
 */
export default function MyBookmarks() {
  const { member } = useSession();
  const bookmarks = useQuery({
    queryKey: ["bookmarks", member?.id ?? null],
    queryFn: loadBookmarks,
    enabled: !!member,
  });

  if (bookmarks.isPending) return <p className="text-sm text-text-muted">불러오는 중…</p>;

  if (bookmarks.isError) {
    return (
      <p className="text-sm text-text-muted">
        북마크를 불러오지 못했습니다.{" "}
        <button
          type="button"
          className="font-semibold text-brand"
          onClick={() => bookmarks.refetch()}
        >
          다시 시도
        </button>
      </p>
    );
  }

  if (bookmarks.data.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
        <p className="text-sm text-text-muted">북마크한 글이 없습니다.</p>
        <p className="mt-1 text-xs text-text-subtle">글 아래 북마크를 누르면 여기 모입니다.</p>
      </div>
    );
  }

  return (
    <section aria-label="북마크한 글" className="flex flex-col gap-3">
      <p className="text-sm text-text-muted tabular-nums">{bookmarks.data.length}개</p>
      <div className="flex flex-col gap-2">
        {bookmarks.data.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
