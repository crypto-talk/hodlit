"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TierBadge from "@/components/holder/tier-badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format/time";
import { isHolderTier } from "@/lib/holder-snapshot/label";
import { commentAnchor } from "@/lib/routes";
import { deleteComment, updateComment } from "../api";
import { isSubmitEnter } from "../enter-to-submit";
import { commentErrorMessage } from "../error-message";
import { COMMENT_MAX, commentProblem } from "../limits";
import type { CommentView } from "../types";

type Props = {
  postId: number;
  /** 글의 방 코인. 미보유 배지에 `ETH 미보유` 로 붙인다. */
  symbol: string;
  comment: CommentView;
  /** 글쓴이의 댓글이면 닉네임 옆에 "작성자" 를 붙인다. 배지가 아니라 글자다. */
  byPostAuthor: boolean;
  /** 로그인한 사람이 쓴 댓글이면 수정 · 삭제 버튼을 보여준다. 검사는 서버가 한다. */
  mine: boolean;
  /**
   * 루트 댓글이면 그 아래 답글 수. 지우면 답글도 함께 지워지므로 삭제 확인에 알린다.
   * 답글이면 0.
   */
  replyCount: number;
  /** "답글" 을 눌렀을 때. 섹션이 이 댓글을 대상으로 답글 칸을 연다. */
  onReply: (comment: CommentView) => void;
  /** 지금 이 댓글에 답글 칸이 열려 있으면 true. 버튼을 눌린 상태로 보인다. */
  replying: boolean;
  /** 주소의 `#comment-{id}` 로 찾아온 댓글이면 true. 바탕이 잠깐 칠해졌다 사라져 어느 댓글인지 보인다. */
  highlighted?: boolean;
};

/**
 * 댓글 한 줄 — 닉네임 · 인증 배지 · 보유 기간 · 시각 · 내용, 본인 댓글이면 수정 · 삭제.
 *
 * 수량 구간은 그리지 않는다(`types.ts` 의 `CommentHolderView` 참고).
 * 인증을 지원하지 않는 방의 댓글에는 배지도 붙이지 않는다. 모든 댓글에
 * "인증 미지원 코인" 이 반복되면 소음이고, 그 사실은 글의 보유 정보 칸이 이미 말한다.
 *
 * 답글(HODL-60)은 본문 앞에 `@닉네임` 을 따로 붙인다. 닉네임은 답글을 쓸 때 서버가 저장한 값이라
 * 그 댓글이 지워져도 남는다. 수정할 때는 본문만 고친다(대상은 바뀌지 않는다).
 *
 * 와이어프레임에서 아직 없는 것: 좋아요 · 신고 (API 없음).
 */
export default function CommentItem({
  postId,
  symbol,
  comment,
  byPostAuthor,
  mine,
  replyCount,
  onReply,
  replying,
  highlighted = false,
}: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [problem, setProblem] = useState("");

  const update = useMutation({
    mutationFn: updateComment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      setEditing(false);
    },
  });

  const remove = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      void queryClient.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  function save() {
    if (update.isPending) return;
    const reason = commentProblem(draft);
    setProblem(reason ?? "");
    if (reason) return;
    update.mutate({ commentId: comment.id, content: draft });
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(comment.content);
    setProblem("");
    update.reset();
  }

  const holder = comment.holder?.verifiable ? comment.holder : null;
  const error = update.error ?? remove.error;
  const errorMessage = problem || (error ? commentErrorMessage(error) : "");

  return (
    <div
      id={commentAnchor(comment.id)}
      className={`scroll-mt-24 py-4 ${highlighted ? "-mx-3 animate-flash rounded-sm px-3" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-text-primary">{comment.nickname}</span>
        {byPostAuthor ? <span className="text-xs font-bold text-text-primary">작성자</span> : null}
        {holder ? <TierBadge tier={holder.tier} symbol={symbol} /> : null}
        {holder && isHolderTier(holder.tier) ? (
          <span className="text-xs text-text-muted">{holder.holding}</span>
        ) : null}
        <time dateTime={comment.createdAt} className="text-xs text-text-muted">
          {formatRelativeTime(comment.createdAt)}
        </time>
        {comment.edited ? <span className="text-xs text-text-muted">· 수정됨</span> : null}
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            aria-label="댓글 수정"
            className="min-h-[72px] w-full resize-y rounded-sm border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:-outline-offset-1 focus:outline-2 focus:outline-brand"
            value={draft}
            maxLength={COMMENT_MAX + 100}
            onChange={(event) => {
              setDraft(event.target.value);
              if (problem) setProblem("");
            }}
            // 새 댓글 입력칸과 같게 Enter 로 저장, Shift+Enter 로 줄바꿈, Esc 로 취소
            onKeyDown={(event) => {
              if (event.key === "Escape" && !update.isPending) {
                event.preventDefault();
                cancelEdit();
                return;
              }
              if (!isSubmitEnter(event)) return;
              event.preventDefault();
              save();
            }}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="mr-auto text-xs text-text-muted tabular-nums">
              {draft.trim().length} / {COMMENT_MAX}
            </span>
            <Button type="button" onClick={cancelEdit} disabled={update.isPending}>
              취소
            </Button>
            <Button type="button" variant="primary" onClick={save} disabled={update.isPending}>
              {update.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-text-primary">
          {comment.replyToNickname ? (
            <span className="mr-1 font-semibold text-brand">@{comment.replyToNickname}</span>
          ) : null}
          {comment.content}
        </p>
      )}

      {editing ? null : (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
          {confirmingDelete ? (
            <>
              <span>
                {replyCount > 0
                  ? `이 댓글을 삭제하면 답글 ${replyCount}개도 함께 삭제됩니다. 삭제할까요?`
                  : "이 댓글을 삭제할까요?"}
              </span>
              <button
                type="button"
                className="font-semibold text-danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(comment.id)}
              >
                {remove.isPending ? "삭제 중…" : "삭제"}
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  setConfirmingDelete(false);
                  remove.reset();
                }}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-pressed={replying}
                className={replying ? "font-semibold text-brand" : undefined}
                onClick={() => onReply(comment)}
              >
                답글
              </button>
              {mine ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(comment.content);
                      setEditing(true);
                    }}
                  >
                    수정
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(true)}>
                    삭제
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      )}

      {errorMessage ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
