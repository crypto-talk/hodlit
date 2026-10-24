"use client";

import { useState } from "react";
import PostCard from "@/components/post/post-card";
import { Button } from "@/components/ui/button";
import type { FeedPost } from "../types";

type Props = {
  posts: FeedPost[];
};

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
          <PostCard key={post.id} post={post} />
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
