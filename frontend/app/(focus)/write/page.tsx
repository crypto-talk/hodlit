import type { Metadata } from "next";
import WriteForm from "@/features/post/components/write-form";
import { safeSymbol } from "@/lib/routes";

export const metadata: Metadata = {
  title: "글쓰기 — Hodlit",
};

/**
 * `?symbol=` 은 방 게시판에서 글쓰기로 넘어올 때 그 방을 미리 고르기 위한 것이다.
 * 로그인 화면의 `?next=` 와 같은 이유로 서버에서 읽어 프롭으로 내린다.
 */
export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;
  return <WriteForm initialSymbol={safeSymbol(symbol)} />;
}
