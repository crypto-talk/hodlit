"use client";

import { useState } from "react";
import type { HotPost } from "../types";
import TierBadge from "./tier-badge";

type Props = {
  posts: HotPost[];
};

export default function HotPosts({ posts }: Props) {
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const visible = verifiedOnly ? posts.filter((post) => post.tier !== "none") : posts;

  return (
    <section>
      <div className="hd-section-head">
        <h2 className="text-h2 font-semibold">오늘의 핫글</h2>
        <span
          className="hd-info"
          title="임시로 댓글 수 기준입니다. 집계 기준은 백엔드와 합의 전입니다"
        >
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
          핫글
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={verifiedOnly}
          className={`hd-tab${verifiedOnly ? " hd-tab-on" : ""}`}
          onClick={() => setVerifiedOnly(true)}
        >
          인증 핫글
        </button>
      </div>

      <div className="hd-hot-list">
        {visible.map((post) => (
          <a key={post.rank} href="#" className="hd-hot-row">
            <span
              className="text-sm font-semibold text-text-muted tabular-nums"
              style={{ width: 24, textAlign: "center", flex: "0 0 auto" }}
            >
              {post.rank}
            </span>
            <span className="hd-chip">{post.symbol}</span>
            <TierBadge tier={post.tier} />
            <span className="text-body truncate" style={{ flex: "1 1 240px", minWidth: 0 }}>
              {post.title}
            </span>
            <span className="text-xs text-text-muted tabular-nums">{post.meta}</span>
          </a>
        ))}
        {visible.length === 0 ? <div className="hd-empty">아직 인증 핫글이 없습니다.</div> : null}
      </div>
    </section>
  );
}
