"use client";

import Link from "next/link";
import { roomHref } from "@/lib/routes";
import { useState } from "react";
import type { HotPost } from "../types";
import TierBadge from "@/components/holder/tier-badge";

type Props = {
  posts: HotPost[];
};

export default function HotPosts({ posts }: Props) {
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const visible = verifiedOnly ? posts.filter((post) => post.tier !== "none") : posts;

  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-h2 font-semibold">오늘의 핫글</h2>
        <span
          className="flex size-4 flex-none cursor-help items-center justify-center rounded-full border border-border-subtle text-xs text-text-muted"
          title="임시로 댓글 수 기준입니다. 집계 기준은 백엔드와 합의 전입니다"
        >
          i
        </span>
      </div>

      <div className="mt-4 flex gap-6 border-b border-border-subtle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!verifiedOnly}
          className={`cursor-pointer border-b-2 border-transparent py-2 text-body font-semibold text-text-muted${verifiedOnly ? "" : " border-b-brand text-text-primary"}`}
          onClick={() => setVerifiedOnly(false)}
        >
          핫글
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={verifiedOnly}
          className={`cursor-pointer border-b-2 border-transparent py-2 text-body font-semibold text-text-muted${verifiedOnly ? " border-b-brand text-text-primary" : ""}`}
          onClick={() => setVerifiedOnly(true)}
        >
          인증 핫글
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {visible.map((post) => (
          // 줄 전체가 글로 가고, 방 칩만 방으로 간다. 링크 안에 링크를 넣을 수 없어서
          // 제목 링크를 줄 전체로 늘리고(after:inset-0) 방 칩을 그 위에 올렸다.
          <div
            key={post.rank}
            className="relative flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface p-4 text-text-primary hover:border-text-muted"
          >
            <span className="w-6 flex-none text-center text-sm font-semibold text-text-muted tabular-nums">
              {post.rank}
            </span>
            <Link
              href={roomHref(post.symbol)}
              className="relative z-10 flex-none rounded-sm border border-border-subtle bg-canvas px-2 py-0.5 text-xs font-semibold text-text-muted hover:border-text-muted hover:text-text-primary"
            >
              {post.symbol}
            </Link>
            {post.verifiable ? <TierBadge tier={post.tier} /> : null}
            <Link
              href={post.href}
              className="min-w-0 flex-1 basis-60 truncate text-body after:absolute after:inset-0"
            >
              {post.title}
            </Link>
            <span className="text-xs text-text-muted tabular-nums">{post.meta}</span>
          </div>
        ))}
        {visible.length === 0 ? (
          <div className="px-4 py-12 text-center text-text-muted">아직 인증 핫글이 없습니다.</div>
        ) : null}
      </div>
    </section>
  );
}
