import type { Metadata } from "next";
import WriteForm from "@/features/post/components/write-form";
import { safeSymbol } from "@/lib/routes";

export const metadata: Metadata = {
  title: "글쓰기 — Hodlit",
};

/**
 * `?symbol=` 은 방 게시판에서 글쓰기로 넘어올 때 그 방을 미리 고르기 위한 것이다.
 * `?draft=` 는 이어 쓸 임시저장 번호다. 숫자가 아니면 무시한다.
 * 로그인 화면의 `?next=` 와 같은 이유로 서버에서 읽어 프롭으로 내린다.
 */
export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; draft?: string }>;
}) {
  const { symbol, draft } = await searchParams;
  const draftId = draft && /^\d+$/.test(draft) ? Number(draft) : null;

  return (
    <WriteForm
      initialSymbol={safeSymbol(symbol)}
      draftId={draftId !== null && Number.isSafeInteger(draftId) ? draftId : null}
    />
  );
}
