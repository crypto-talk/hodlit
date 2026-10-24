import Link from "next/link";
import { formatRelativeTime } from "@/lib/format/time";
import { draftHref } from "@/lib/routes";
import type { DraftSummary } from "../types";

type Props = {
  draft: DraftSummary;
  /** 지금 쓰고 있는 임시저장이면 "작성 중" 을 붙인다. 글쓰기 위 목록만 쓴다. */
  current?: boolean;
  deleting: boolean;
  onDelete: (id: number) => void;
};

/**
 * 임시저장 목록 한 줄. 글쓰기 위에 펼치는 목록과 마이페이지 임시저장 탭이 같이 쓴다.
 *
 * 글 수정 임시저장(HODL-56)은 "수정 중" 을 붙이고 그 글의 수정 화면으로 간다. 원래 글이
 * 지워졌으면 수정 화면이 "글을 찾을 수 없습니다" 를 보인다 — 서버가 내용을 일부러 남겨
 * 두므로 여기서 숨기지 않고, 지우는 것은 사람이 한다.
 */
export default function DraftRow({ draft, current = false, deleting, onDelete }: Props) {
  const editing = draft.sourcePostId !== null;

  return (
    <li className="flex items-center gap-3 border-b border-border-subtle py-2 last:border-b-0">
      <Link href={draftHref(draft)} className="min-w-0 flex-1 hover:text-brand">
        <span className="flex items-center gap-2">
          {editing ? (
            <span className="flex-none rounded-sm border border-border-subtle px-1.5 py-px text-xs text-text-muted">
              수정 중
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold">
            {draft.title.trim() || "(제목 없음)"}
          </span>
        </span>
        <span className="block text-xs text-text-muted">
          {draft.coinSymbol || "방 미선택"} · {formatRelativeTime(draft.updatedAt)}
          {current ? " · 작성 중" : ""}
        </span>
      </Link>
      <button
        type="button"
        className="flex-none text-xs text-text-muted hover:text-danger"
        disabled={deleting}
        onClick={() => onDelete(draft.id)}
      >
        삭제
      </button>
    </li>
  );
}
