"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { createComment } from "../api";
import { commentErrorMessage } from "../error-message";
import { COMMENT_MAX, commentProblem } from "../limits";

type Props = {
  postId: number;
  /** 이 글의 방이 보유 인증을 지원하는지. true 면 보유 정보 안내 문구를 보여준다. */
  verifiable: boolean;
  /**
   * 답글이면 답할 댓글. 입력칸 위에 `@닉네임에게 답글` 을 보이고 취소 버튼을 둔다.
   * 없으면 맨 아래 새 댓글 입력칸이다.
   */
  replyTo?: { commentId: number; nickname: string };
  /** 답글 등록이 끝났거나 취소했을 때. 열린 답글 칸을 닫는 데 쓴다. */
  onClose?: () => void;
};

/**
 * 댓글 입력. 로그인하지 않았으면 입력칸 대신 로그인 안내를 보여준다.
 *
 * 와이어프레임에서 아직 없는 것
 *   - 이모지 반응 줄 (저장 형태 미정, API 없음)
 *   - "이 댓글에는 지갑연결 · 8개월 보유가 붙습니다" 미리보기 (`/me/assets` 로 만들 수 있지만
 *     글쓰기 화면의 같은 미리보기와 함께 정한다)
 */
export default function CommentForm({ postId, verifiable, replyTo, onClose }: Props) {
  const { member, restored } = useSession();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [problem, setProblem] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTarget = replyTo?.commentId;

  // 답글 칸은 "답글"을 눌러 열리므로 바로 쓸 수 있게 입력칸으로 옮긴다. 다른 댓글의 "답글"을
  // 누르면 같은 칸이 대상만 바뀌어 다시 열린다.
  useEffect(() => {
    if (replyTarget !== undefined) textareaRef.current?.focus();
  }, [replyTarget]);

  const create = useMutation({
    mutationFn: createComment,
    // 재조회를 기다리지 않는다. 기다리면 그동안 버튼이 "등록 중…"에 묶여 느리게 느껴진다.
    onSuccess: () => {
      setContent("");
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      // 글 하단의 댓글 수(답글도 센다)
      void queryClient.invalidateQueries({ queryKey: ["post", postId] });
      onClose?.();
    },
  });

  if (!restored) {
    return <div className="h-[104px] rounded-sm border border-border-subtle bg-canvas" />;
  }

  if (!member) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-border-subtle bg-canvas p-4 text-sm text-text-muted">
        <span className="flex-1">로그인하면 {replyTo ? "답글을" : "댓글을"} 남길 수 있습니다.</span>
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="font-semibold text-brand"
        >
          로그인
        </Link>
      </div>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    const reason = commentProblem(content);
    setProblem(reason ?? "");
    if (reason) return;
    create.mutate({ postId, content, replyToCommentId: replyTo?.commentId });
  }

  const length = content.trim().length;
  const errorMessage = problem || (create.error ? commentErrorMessage(create.error) : "");

  return (
    <form onSubmit={submit} className="rounded-sm border border-border-subtle bg-canvas p-3">
      {replyTo ? (
        <p className="mb-2 text-xs text-text-muted">
          <span className="font-semibold text-brand">@{replyTo.nickname}</span>에게 답글
        </p>
      ) : null}
      <textarea
        ref={textareaRef}
        aria-label={replyTo ? `${replyTo.nickname}에게 답글 입력` : "댓글 입력"}
        className="min-h-[72px] w-full resize-y rounded-sm border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:-outline-offset-1 focus:outline-2 focus:outline-brand"
        placeholder={replyTo ? "답글을 남겨보세요" : "댓글로 의견을 남겨보세요"}
        value={content}
        maxLength={COMMENT_MAX + 100}
        onChange={(event) => {
          setContent(event.target.value);
          if (problem) setProblem("");
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        {verifiable ? (
          <span>댓글에는 인증 등급과 보유 기간만 붙고, 수량은 표시되지 않습니다.</span>
        ) : null}
        <span className="flex-1" />
        <span className={`tabular-nums ${length > COMMENT_MAX ? "text-danger" : ""}`}>
          {length} / {COMMENT_MAX}
        </span>
        {replyTo ? (
          <Button type="button" onClick={onClose} disabled={create.isPending}>
            취소
          </Button>
        ) : null}
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? "등록 중…" : "등록"}
        </Button>
      </div>
      {errorMessage ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
