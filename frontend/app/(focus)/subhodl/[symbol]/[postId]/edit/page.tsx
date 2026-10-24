import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EditForm from "@/features/post/components/edit-form";

export const metadata: Metadata = {
  title: "글 수정 — Hodlit",
};

/**
 * 글 수정. 글쓰기처럼 헤더만 있는 독립 페이지다(A-3).
 *
 * 글 id 가 숫자가 아니면 바로 404. 작성자 확인은 로그인 상태가 필요해서
 * 클라이언트(`EditForm`)와 서버(PUT 의 403)가 한다.
 */
export default async function EditPage({
  params,
}: {
  params: Promise<{ symbol: string; postId: string }>;
}) {
  const { symbol, postId } = await params;
  const id = Number(postId);
  if (!/^\d+$/.test(postId) || !Number.isSafeInteger(id)) notFound();

  return <EditForm postId={id} symbol={decodeURIComponent(symbol).toUpperCase()} />;
}
