"use client";

import { useEffect, useState } from "react";
import { dailyVotes, loadFeed, trendingRooms } from "@/features/landing/api";
import HotPosts from "@/features/landing/components/hot-posts";
import PostFeed from "@/features/landing/components/post-feed";
import TrendingRooms from "@/features/landing/components/trending-rooms";
import VotePanel from "@/features/landing/components/vote-panel";
import type { FeedPost, HotPost } from "@/features/landing/types";
import { useRequireLogin } from "@/lib/session";

/**
 * 호들잇 랜딩.
 *
 * 셸(헤더·전광판·사이드바·푸터·FAB)은 `app/(shell)/layout.tsx` 가 그린다.
 * 이 파일은 가운데 칼럼의 섹션만 들고 있다.
 *
 * 백엔드에서 오는 것 — 전체 글과 핫글 (`GET /feed`)
 * 아직 목데이터인 것 — 지금 뜨는 방(G-3), 오늘의 투표(G-5). API 자체가 없다.
 *
 * 불러오기에 실패하면 목데이터로 가리지 않고 화면에 알린다. 배포본에서
 * 백엔드가 안 붙은 것을 바로 알아야 하기 때문이다.
 */
export default function Landing() {
  const requireLogin = useRequireLogin();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [hot, setHot] = useState<HotPost[]>([]);
  const [notice, setNotice] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadFeed()
      .then((feed) => {
        if (!alive) return;
        setPosts(feed.posts);
        setHot(feed.hot);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const onVote = () => {
    // 로그인 전이면 /login 으로 보낸다. 로그인돼 있으면 아직 할 수 있는 게 없다.
    if (requireLogin()) return;
    setNotice("투표는 아직 준비 중입니다.");
  };

  return (
    <>
      {loadFailed ? (
        <p role="status" className="text-sm" style={{ color: "var(--hd-down)" }}>
          백엔드에서 데이터를 불러오지 못했습니다. API 주소와 CORS 설정을 확인해 주세요.
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm" style={{ color: "var(--hd-down)" }}>
          {notice}
        </p>
      ) : null}

      {/* 인기글 → 인기 게시판 → 투표 → 전체 글. 읽을거리를 먼저 보여준다. */}
      <HotPosts posts={hot} />
      <TrendingRooms rooms={trendingRooms()} />
      <VotePanel votes={dailyVotes()} onVote={onVote} />
      <PostFeed posts={posts} />
    </>
  );
}
