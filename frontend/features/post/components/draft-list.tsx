"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format/time";
import { useSession } from "@/lib/session";
import { deleteDraft, loadDrafts } from "../api";

type Props = {
  /** 지금 쓰고 있는 임시저장. 목록에서 "작성 중" 으로 표시한다. */
  currentId: number | null;
  /** 지운 뒤 부른다. 지금 쓰던 것을 지웠으면 글쓰기 쪽이 번호를 비운다. */
  onDeleted: (id: number) => void;
};

/**
 * 글쓰기 위에 펼치는 임시저장 목록. 회원당 10개까지라 페이지 없이 전부 보인다.
 *
 * 고르면 `/write?draft=<번호>` 로 간다. 지금 쓰던 내용은 그대로 버려진다 — 저장하지
 * 않은 내용이 있으면 먼저 임시저장하라고 안내만 한다.
 */
export default function DraftList({ currentId, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const { member } = useSession();
  const drafts = useQuery({
    queryKey: ["drafts", member?.id ?? null],
    queryFn: loadDrafts,
    enabled: !!member,
  });

  const remove = useMutation({
    mutationFn: deleteDraft,
    onSuccess: (_, id) => {
      onDeleted(id);
      void queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });

  const list = drafts.data ?? [];

  return (
    <section
      aria-label="임시저장 목록"
      className="mt-4 rounded-lg border border-border-subtle bg-surface p-4"
    >
      <div className="flex items-baseline gap-2">
        <h2 className="flex-1 text-sm font-semibold text-text-primary">
          임시저장{" "}
          {drafts.data ? (
            <span className="text-text-muted tabular-nums">{list.length}/10</span>
          ) : null}
        </h2>
        <span className="text-xs text-text-muted">불러오면 지금 쓰던 내용은 사라집니다</span>
      </div>

      {drafts.isPending ? (
        <p className="mt-2 text-sm text-text-muted">불러오는 중…</p>
      ) : drafts.isError ? (
        <p className="mt-2 text-sm text-text-muted">
          불러오지 못했습니다.{" "}
          <button
            type="button"
            className="font-semibold text-brand"
            onClick={() => drafts.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : list.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">임시저장한 글이 없습니다.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {list.map((draft) => (
            <li
              key={draft.id}
              className="flex items-center gap-3 border-b border-border-subtle py-2 last:border-b-0"
            >
              <Link href={`/write?draft=${draft.id}`} className="min-w-0 flex-1 hover:text-brand">
                <span className="block truncate text-sm font-semibold">
                  {draft.title.trim() || "(제목 없음)"}
                </span>
                <span className="block text-xs text-text-muted">
                  {draft.coinSymbol || "방 미선택"} · {formatRelativeTime(draft.updatedAt)}
                  {draft.id === currentId ? " · 작성 중" : ""}
                </span>
              </Link>
              <button
                type="button"
                className="flex-none text-xs text-text-muted hover:text-danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(draft.id)}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {remove.isError ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          삭제하지 못했습니다.
        </p>
      ) : null}
    </section>
  );
}
