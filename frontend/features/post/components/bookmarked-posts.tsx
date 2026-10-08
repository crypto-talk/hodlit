"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format/time";
import { postHref } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { loadBookmarks } from "../api";

/** 칸이 길어지지 않게 위에서 몇 개만 보인다. */
const LIMIT = 10;

/**
 * 오른쪽 칸의 "북마크한 글" — ⚠️ 임시.
 *
 * 마이페이지가 아직 없어서 북마크가 실제로 쌓이는지 볼 자리가 없다. 마이페이지에
 * 북마크 탭이 생기면 이 칸을 지운다.
 *
 * 로그인 전에는 그리지 않는다. 글 상세에서 북마크를 누르면 `["bookmarks"]` 가
 * 무효화돼 여기가 다시 받아 온다.
 */
export default function BookmarkedPosts() {
  const { member } = useSession();
  const bookmarks = useQuery({
    queryKey: ["bookmarks", member?.id ?? null],
    queryFn: loadBookmarks,
    enabled: !!member,
  });

  if (!member) return null;

  const list = bookmarks.data ?? [];

  return (
    <section
      aria-label="북마크한 글"
      className="rounded-lg border border-border-subtle bg-surface p-4"
    >
      <div className="flex items-baseline gap-2">
        <h2 className="flex-1 text-xs font-semibold tracking-[0.06em] text-text-muted">
          북마크한 글
        </h2>
        {bookmarks.data ? (
          <span className="text-xs text-text-muted tabular-nums">{list.length}</span>
        ) : null}
      </div>

      {bookmarks.isPending ? (
        <p className="mt-2 text-sm text-text-muted">불러오는 중…</p>
      ) : bookmarks.isError ? (
        <p className="mt-2 text-sm text-text-muted">
          불러오지 못했습니다.{" "}
          <button
            type="button"
            className="font-semibold text-brand"
            onClick={() => bookmarks.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : list.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">글 아래 북마크를 누르면 여기 모입니다.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {list.slice(0, LIMIT).map((post) => (
            <li key={post.id}>
              <Link
                href={postHref(post.coinSymbol, post.id)}
                className="block rounded-sm py-1.5 hover:bg-canvas"
              >
                <span className="block truncate text-sm font-semibold text-text-primary">
                  {post.title}
                </span>
                <span className="block text-xs text-text-muted">
                  {post.coinSymbol} · {formatRelativeTime(post.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
