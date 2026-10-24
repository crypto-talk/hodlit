import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostView from "./post-view";

export const metadata: Metadata = {
  title: "글 — Hodlit",
};

/**
 * 글 상세. 주소는 `/subhodl/[symbol]/[postId]` (A-2).
 *
 * 글 id 가 숫자가 아니면 요청을 보내지 않고 바로 404 다.
 * 데이터는 클라이언트에서 가져온다 — 랜딩과 같은 이유로, access 토큰이 쿠키로
 * 옮겨지기 전(B-3)에는 서버가 로그인 상태(좋아요 여부 등)를 알 수 없다.
 */
export default async function PostPage({
  params,
}: {
  params: Promise<{ symbol: string; postId: string }>;
}) {
  const { symbol, postId } = await params;
  const id = Number(postId);
  if (!/^\d+$/.test(postId) || !Number.isSafeInteger(id)) notFound();

  return <PostView postId={id} symbol={decodeURIComponent(symbol).toUpperCase()} />;
}
