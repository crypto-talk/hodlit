"use client";

import { FormEvent, useState } from "react";
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
  /** 이 글의 방이 보유 인증을 지원하는지. true 면 보내기 직전에 보유 기록을 갱신한다. */
  verifiable: boolean;
};

/**
 * 댓글 입력. 로그인하지 않았으면 입력칸 대신 로그인 안내를 보여준다.
 *
 * 와이어프레임에서 아직 없는 것
 *   - 이모지 반응 줄 (저장 형태 미정, API 없음)
 *   - "이 댓글에는 지갑연결 · 8개월 보유가 붙습니다" 미리보기 (`/me/assets` 로 만들 수 있지만
 *     글쓰기 화면의 같은 미리보기와 함께 정한다)
 */
export default function CommentForm({ postId, verifiable }: Props) {
  const { member, restored } = useSession();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [problem, setProblem] = useState("");

  const create = useMutation({
    mutationFn: createComment,
    onSuccess: async () => {
      setContent("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["comments", postId] }),
        // 글 하단의 댓글 수
        queryClient.invalidateQueries({ queryKey: ["post", postId] }),
      ]);
    },
  });

  if (!restored) {
    return <div className="h-[104px] rounded-sm border border-border-subtle bg-canvas" />;
  }

  if (!member) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-border-subtle bg-canvas p-4 text-sm text-text-muted">
        <span className="flex-1">로그인하면 댓글을 남길 수 있습니다.</span>
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
    create.mutate({ postId, content, verifiable });
  }

  const length = content.trim().length;
  const errorMessage = problem || (create.error ? commentErrorMessage(create.error) : "");

  return (
    <form onSubmit={submit} className="rounded-sm border border-border-subtle bg-canvas p-3">
      <textarea
        aria-label="댓글 입력"
        className="min-h-[72px] w-full resize-y rounded-sm border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary focus:-outline-offset-1 focus:outline-2 focus:outline-brand"
        placeholder="댓글로 의견을 남겨보세요"
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
