"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FeedPost } from "../types";
import TierBadge from "./tier-badge";

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
    <section className="hd-feed">
      <div className="hd-section-head">
        <h2 className="text-h2 font-semibold">전체 글</h2>
        <span className="hd-info" title="활동 피드를 최신순으로 보여줍니다">
          i
        </span>
      </div>

      <div className="hd-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!verifiedOnly}
          className={`hd-tab${verifiedOnly ? "" : " hd-tab-on"}`}
          onClick={() => setVerifiedOnly(false)}
        >
          전체
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={verifiedOnly}
          className={`hd-tab${verifiedOnly ? " hd-tab-on" : ""}`}
          onClick={() => setVerifiedOnly(true)}
        >
          인증
        </button>
      </div>

      <div className="hd-post-list">
        {visible.map((post) => (
          <article key={post.id} className="hd-post">
            <div className="hd-post-head">
              <span className="hd-chip">{post.symbol}</span>
              <TierBadge tier={post.tier} />
              {post.range ? <span className="hd-range">{post.range}</span> : null}
              <span style={{ flex: 1 }} />
              <span className="text-xs text-text-muted">{post.time}</span>
            </div>

            <a href="#" className="hd-post-title">
              {post.title}
            </a>
            <p className="text-body text-text-muted" style={{ marginTop: 8 }}>
              {post.preview}
            </p>

            <div className="hd-post-foot">
              <a href="#" className="text-sm font-semibold">
                {post.nick}
              </a>
              {/* 인덱서가 붙기 전까지 서버 holdingMonths가 null이라 항상 '보유 기간 미확인'입니다. */}
              <span
                className="text-sm"
                style={{ color: post.tier === "wallet" ? "var(--hd-ink)" : "var(--hd-sub)" }}
              >
                {post.hold || "보유 기록 없음"}
              </span>
              <span style={{ flex: 1 }} />
              <span className="text-xs text-text-muted tabular-nums">{stats(post)}</span>
            </div>
          </article>
        ))}
        {visible.length === 0 ? <div className="hd-empty">아직 인증된 글이 없습니다.</div> : null}
      </div>

      <Button type="button" className="mt-4 w-full p-4">
        더 보기
      </Button>
    </section>
  );
}
