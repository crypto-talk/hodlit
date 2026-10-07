"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import TierBadge from "@/components/holder/tier-badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format/time";
import { deleteComment, updateComment } from "../api";
import { commentErrorMessage } from "../error-message";
import { COMMENT_MAX, commentProblem } from "../limits";
import type { CommentView } from "../types";

type Props = {
  postId: number;
  comment: CommentView;
  /** 글쓴이의 댓글이면 닉네임 옆에 "작성자" 를 붙인다. 배지가 아니라 글자다. */
  byPostAuthor: boolean;
  /** 로그인한 사람이 쓴 댓글이면 수정 · 삭제 버튼을 보여준다. 검사는 서버가 한다. */
  mine: boolean;
};

/**
 * 댓글 한 줄 — 닉네임 · 인증 배지 · 보유 기간 · 시각 · 내용, 본인 댓글이면 수정 · 삭제.
 *
 * 수량 구간은 그리지 않는다(`types.ts` 의 `CommentHolderView` 참고).
 * 인증을 지원하지 않는 방(BTC 등)의 댓글에는 배지도 붙이지 않는다. 모든 댓글에
 * "인증 미지원 코인" 이 반복되면 소음이고, 그 사실은 글의 보유 정보 칸이 이미 말한다.
 *
 * 와이어프레임에서 아직 없는 것: 좋아요 · 답글 · 신고 (API 없음).
 */
export default function CommentItem({ postId, comment, byPostAuthor, mine }: Props) {
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["comments", postId] }),
        queryClient.invalidateQueries({ queryKey: ["post", postId] }),
      ]);
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
    <li className="border-b border-border-subtle py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-text-primary">{comment.nickname}</span>
        {byPostAuthor ? <span className="text-xs font-bold text-text-primary">작성자</span> : null}
        {holder ? <TierBadge tier={holder.tier} /> : null}
        {holder && holder.tier !== "none" ? (
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
          {comment.content}
        </p>
      )}

      {mine && !editing ? (
        <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
          {confirmingDelete ? (
            <>
              <span>이 댓글을 삭제할까요?</span>
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
          )}
        </div>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
    </li>
  );
}
