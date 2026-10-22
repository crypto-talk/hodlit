"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { loadFeed, loadTrendingRooms } from "@/features/landing/api";
import PostFeed from "@/features/landing/components/post-feed";
import TrendingRooms from "@/features/landing/components/trending-rooms";
import type { FeedPost } from "@/features/landing/types";
import OpenPolls from "@/features/vote/components/open-polls";

/**
 * 호들잇 랜딩.
 *
 * 셸(헤더·전광판·사이드바·푸터·FAB)은 `app/(shell)/layout.tsx` 가 그린다.
 * 이 파일은 가운데 칼럼의 섹션만 들고 있다.
 *
 * 백엔드에서 오는 것 — 전체 글 (`GET /feed`), 지금 뜨는 방 (`GET /communities/stats`),
 * 오늘의 투표 (방마다 `GET /communities/{symbol}/poll`, HODL-64. `features/vote`).
 * 핫글 섹션은 HODL-86 으로 뺐다. 목데이터는 이제 없다.
 *
 * 뜨는 방은 피드와 따로 받고 따로 실패한다. 한쪽이 안 와도 다른 쪽은 보여야 한다.
 *
 * 불러오기에 실패하면 목데이터로 가리지 않고 화면에 알린다. 배포본에서
 * 백엔드가 안 붙은 것을 바로 알아야 하기 때문이다.
 */
export default function Landing() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const trending = useQuery({ queryKey: ["trending-rooms"], queryFn: loadTrendingRooms });

  useEffect(() => {
    let alive = true;
    loadFeed()
      .then((feed) => {
        if (alive) setPosts(feed);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      {loadFailed ? (
        <p role="status" className="text-sm text-danger">
          백엔드에서 데이터를 불러오지 못했습니다. API 주소와 CORS 설정을 확인해 주세요.
        </p>
      ) : null}

      {/* 인기 게시판 → 투표 → 전체 글. */}
      <TrendingRooms
        rooms={trending.data ?? null}
        failed={trending.isError}
        onRetry={() => trending.refetch()}
      />
      <OpenPolls />
      <PostFeed posts={posts} />
    </>
  );
}
