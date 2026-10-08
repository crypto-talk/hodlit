"use client";

import { useQuery } from "@tanstack/react-query";
import { isHolderTier } from "@/lib/holder-snapshot/label";
import { useSession } from "@/lib/session";
import { loadComments } from "../api";
import CommentForm from "./comment-form";
import CommentItem from "./comment-item";

type Props = {
  postId: number;
  /** 글의 방 코인. 미보유 배지 문구에 쓴다. */
  symbol: string;
  /** 글쓴이 회원 id. 글쓴이 댓글에 "작성자" 를 붙인다. */
  postAuthorId: number | null;
  /** 이 글의 방이 보유 인증을 지원하는지. 글의 보유 정보에서 온다. */
  verifiable: boolean;
};

/**
 * 글 상세의 댓글 — 머리줄(댓글 수 · 보유 인증자 수) + 목록 + 입력.
 *
 * 글 상세가 `features/post` 라 여기서 글을 직접 불러오지 않는다(features 끼리 참조 금지).
 * 필요한 글 정보는 상세 페이지(`app/`)가 넘겨준다.
 *
 * 목록은 오래된 순(서버 순서 그대로)이다. 새 댓글은 맨 아래에 붙는다.
 * 서버에 페이지가 없어 한 번에 전부 받고, "더 보기" 도 없다.
 */
export default function CommentSection({ postId, symbol, postAuthorId, verifiable }: Props) {
  const { member } = useSession();
  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => loadComments(postId),
  });

  const list = comments.data ?? [];
  // "보유 인증자 N명" — 같은 사람이 여러 번 써도 한 명이다.
  const verifiedHolders = new Set(
    list
      .filter((comment) => comment.holder?.verifiable && isHolderTier(comment.holder.tier))
      .map((comment) => comment.memberId ?? `comment-${comment.id}`),
  ).size;

  return (
    <section aria-label="댓글" className="rounded-lg border border-border-subtle bg-surface p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-body font-semibold text-text-primary">
          댓글 <span className="tabular-nums">{comments.data ? list.length : ""}</span>
        </h2>
        {verifiable && comments.data ? (
          <span className="rounded-sm border border-border-subtle bg-canvas px-2 py-0.5 text-xs text-text-muted tabular-nums">
            보유 인증자 {verifiedHolders}명
          </span>
        ) : null}
      </div>

      {comments.isPending ? (
        <p className="mt-4 text-sm text-text-muted">댓글을 불러오는 중…</p>
      ) : comments.isError ? (
        <div className="mt-4 text-sm text-text-muted">
          댓글을 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="font-semibold text-brand"
            onClick={() => comments.refetch()}
          >
            다시 시도
          </button>
        </div>
      ) : list.length === 0 ? (
        <p className="mt-6 text-center text-sm text-text-muted">첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="mt-2">
          {list.map((comment) => (
            <CommentItem
              key={comment.id}
              postId={postId}
              symbol={symbol}
              comment={comment}
              byPostAuthor={postAuthorId !== null && comment.memberId === postAuthorId}
              mine={!!member && comment.memberId === member.id}
            />
          ))}
        </ul>
      )}

      {/* 목록이 오래된 순이라 새 댓글이 붙는 맨 아래에 입력칸을 둔다. */}
      <div className="mt-4">
        <CommentForm postId={postId} verifiable={verifiable} />
      </div>
    </section>
  );
}
