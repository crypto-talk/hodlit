"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { writeHref } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { deleteDraft, loadDrafts } from "../api";
import { useClosedRoomSymbols } from "../hooks/use-write-rooms";
import DraftRow from "./draft-row";

/** 서버 한도. 새 글과 글 수정 임시저장을 합친 개수다(HODL-43 · 56). */
const DRAFT_MAX = 10;

/**
 * 마이페이지 임시저장 탭.
 *
 * 글쓰기 위의 목록과 같은 줄(`draft-row.tsx`)을 쓴다. 다른 점은 지금 쓰는 글이 없어
 * "작성 중" 표시와 "불러오면 지금 쓰던 내용은 사라집니다" 안내가 없다는 것.
 * 쿼리 키도 같아서(`["drafts", 회원]`) 글쓰기 · 수정에서 저장하면 여기도 새로 받는다.
 */
export default function MyDrafts() {
  const queryClient = useQueryClient();
  const { member } = useSession();
  const drafts = useQuery({
    queryKey: ["drafts", member?.id ?? null],
    queryFn: loadDrafts,
    enabled: !!member,
  });

  const closedRooms = useClosedRoomSymbols();

  const remove = useMutation({
    mutationFn: deleteDraft,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });

  if (drafts.isPending) return <p className="text-sm text-text-muted">불러오는 중…</p>;

  if (drafts.isError) {
    return (
      <p className="text-sm text-text-muted">
        임시저장을 불러오지 못했습니다.{" "}
        <button type="button" className="font-semibold text-brand" onClick={() => drafts.refetch()}>
          다시 시도
        </button>
      </p>
    );
  }

  const list = drafts.data;

  return (
    <section aria-label="임시저장" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <p className="flex-1 text-sm text-text-muted">
          새 글과 수정 중인 글을 합쳐 {DRAFT_MAX}개까지 저장됩니다. 발행하거나 수정을 저장하면
          지워집니다.
        </p>
        <span className="text-sm text-text-muted tabular-nums">
          {list.length}/{DRAFT_MAX}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">임시저장한 글이 없습니다.</p>
          <Link href={writeHref()} className="mt-2 inline-block text-sm font-semibold text-brand">
            글쓰기
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col rounded-lg border border-border-subtle bg-surface px-4 py-2">
          {list.map((draft) => (
            <DraftRow
              key={draft.id}
              draft={draft}
              roomClosed={closedRooms.has(draft.coinSymbol)}
              deleting={remove.isPending}
              onDelete={remove.mutate}
            />
          ))}
        </ul>
      )}

      {remove.isError ? (
        <p role="alert" className="text-sm text-danger">
          삭제하지 못했습니다.
        </p>
      ) : null}
    </section>
  );
}
