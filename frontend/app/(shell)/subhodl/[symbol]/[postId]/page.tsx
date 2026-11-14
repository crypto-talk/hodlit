import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { loadPost } from "@/features/post/api";
import { postQueryKey } from "@/features/post/query-key";
import {
  postCanonicalPath,
  postDescription,
  postStructuredData,
  toJsonLd,
} from "@/features/post/structured-data";
import type { PostDetail } from "@/features/post/types";
import { ApiError } from "@/lib/http";
import { siteOrigin } from "@/lib/site-origin";
import PostView from "./post-view";

type Params = Promise<{ symbol: string; postId: string }>;

function parsePostId(postId: string): number | null {
  const id = Number(postId);
  return /^\d+$/.test(postId) && Number.isSafeInteger(id) ? id : null;
}

/**
 * 비로그인으로 글을 받는다. `generateMetadata` 와 페이지가 같은 요청 안에서 한 번만 부른다.
 *
 * - 없는 글(404)은 `"missing"` — 페이지가 404 로 답한다
 * - 닫힌 방(403) · 서버 오류 · 시간 초과는 `null` — 예전처럼 브라우저가 받아 안내한다.
 *   서버에서 못 받았다고 화면을 막지 않는다
 */
const loadPublicPost = cache(async (id: number): Promise<PostDetail | "missing" | null> => {
  try {
    // 백엔드가 늦으면 기다리지 않는다. 그때는 브라우저가 받는다.
    return await loadPost(id, { signal: AbortSignal.timeout(3000) });
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 404) return "missing";
    return null;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = parsePostId((await params).postId);
  const post = id === null ? null : await loadPublicPost(id);
  if (post === null || post === "missing") return { title: "글" };

  const description = postDescription(post);
  const canonical = postCanonicalPath(post);
  const image = post.images[0]?.src ?? "/og.png";
  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: post.title,
      description,
      publishedTime: post.createdAt || undefined,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: post.title, description, images: [image] },
  };
}

/**
 * 글 상세. 주소는 `/subhodl/[symbol]/[postId]` (A-2).
 *
 * 글 id 가 숫자가 아니면 요청을 보내지 않고 바로 404 다.
 *
 * 글은 서버에서 비로그인으로 한 번 받아 첫 HTML 에 그린다 — 검색엔진 · AI 크롤러는
 * 자바스크립트를 돌리지 않는 경우가 많아, 브라우저에서만 받으면 빈 페이지로 보인다.
 * 좋아요 · 북마크 여부처럼 보는 사람마다 다른 값은 access 토큰이 쿠키로 옮겨지기 전(B-3)
 * 에는 서버가 알 수 없으므로, 브라우저가 세션을 되살린 뒤 다시 받아 덮는다(`usePost`).
 * 댓글은 아직 브라우저에서만 받는다.
 */
export default async function PostPage({ params }: { params: Params }) {
  const { symbol, postId } = await params;
  const id = parsePostId(postId);
  if (id === null) notFound();

  const post = await loadPublicPost(id);
  if (post === "missing") notFound();

  const view = <PostView postId={id} symbol={decodeURIComponent(symbol).toUpperCase()} />;
  if (post === null) return view;

  const queryClient = new QueryClient();
  queryClient.setQueryData(postQueryKey(id, null), post);
  const origin = await siteOrigin();

  return (
    <>
      <script
        type="application/ld+json"
        // 서버가 만든 JSON 이고 `<` 는 이스케이프돼 있다.
        dangerouslySetInnerHTML={{ __html: toJsonLd(postStructuredData(post, origin)) }}
      />
      <HydrationBoundary state={dehydrate(queryClient)}>{view}</HydrationBoundary>
    </>
  );
}
