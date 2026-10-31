import Link from "next/link";
import { formatRelativeTime } from "@/lib/format/time";
import { draftHref } from "@/lib/routes";
import type { DraftSummary } from "../types";

type Props = {
  draft: DraftSummary;
  /** 지금 쓰고 있는 임시저장이면 "작성 중" 을 붙인다. 글쓰기 위 목록만 쓴다. */
  current?: boolean;
  /**
   * 방이 닫혀 있는지(HODL-77). 새 글이면 이어 쓸 때 방을 다시 고른다. 글 수정이면 방이 다시
   * 열릴 때까지 수정 화면이 닫힌 방 안내만 보인다.
   */
  roomClosed?: boolean;
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
export default function DraftRow({
  draft,
  current = false,
  roomClosed = false,
  deleting,
  onDelete,
}: Props) {
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
          {draft.coinSymbol || "방 미선택"}
          {roomClosed ? <span className="text-danger"> (닫힌 방)</span> : null} ·{" "}
          {formatRelativeTime(draft.updatedAt)}
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
