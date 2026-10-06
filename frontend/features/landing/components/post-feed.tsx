"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FeedPost } from "../types";
import TierBadge from "@/components/holder/tier-badge";

type Props = {
  posts: FeedPost[];
};

// 조회수 API가 없습니다. 값이 없으면 숫자를 지어내지 않고 자리를 뺍니다(G-5).
const stats = (post: FeedPost) =>
  post.views === null
    ? `댓글 ${post.comments}`
    : `댓글 ${post.comments} · 조회 ${post.views.toLocaleString("en-US")}`;

export default function PostFeed({ posts }: Props) {
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const visible = verifiedOnly ? posts.filter((post) => post.tier !== "none") : posts;

  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-h2 font-semibold">전체 글</h2>
        <span
          className="flex size-4 flex-none cursor-help items-center justify-center rounded-full border border-border-subtle text-xs text-text-muted"
          title="활동 피드를 최신순으로 보여줍니다"
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
          전체
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={verifiedOnly}
          className={`cursor-pointer border-b-2 border-transparent py-2 text-body font-semibold text-text-muted${verifiedOnly ? " border-b-brand text-text-primary" : ""}`}
          onClick={() => setVerifiedOnly(true)}
        >
          인증
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {visible.map((post) => (
          <article key={post.id} className="rounded-lg border border-border-subtle bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-none rounded-sm border border-border-subtle bg-canvas px-2 py-0.5 text-xs font-semibold text-text-muted">
                {post.symbol}
              </span>
              {post.verifiable ? <TierBadge tier={post.tier} /> : null}
              {post.range ? (
                <span className="flex-none rounded-sm border border-border-subtle px-2 py-0.5 text-xs text-text-muted tabular-nums">
                  {post.range}
                </span>
              ) : null}
              <span className="flex-1" />
              <span className="text-xs text-text-muted">{post.time}</span>
            </div>

            <Link
              href={post.href}
              className="mt-4 block text-h2 font-semibold text-text-primary hover:text-brand"
            >
              {post.title}
            </Link>
            <p className="mt-2 text-body text-text-muted">{post.preview}</p>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border-subtle pt-4">
              <a href="#" className="text-sm font-semibold">
                {post.nick}
              </a>
              {/* 인덱서가 붙기 전까지 서버 holdingMonths가 null이라 항상 '보유 기간 미확인'입니다. */}
              <span
                className={`text-sm ${post.tier === "wallet" ? "text-text-primary" : "text-text-muted"}`}
              >
                {post.hold || "보유 기록 없음"}
              </span>
              <span className="flex-1" />
              <span className="text-xs text-text-muted tabular-nums">{stats(post)}</span>
            </div>
          </article>
        ))}
        {visible.length === 0 ? (
          <div className="px-4 py-12 text-center text-text-muted">아직 인증된 글이 없습니다.</div>
        ) : null}
      </div>

      <Button type="button" className="mt-4 w-full p-4">
        더 보기
      </Button>
    </section>
  );
}
