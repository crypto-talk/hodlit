"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CornerDownRight } from "lucide-react";
import { isHolderTier } from "@/lib/holder-snapshot/label";
import { useSession } from "@/lib/session";
import { loadComments } from "../api";
import CommentForm from "./comment-form";
import CommentItem from "./comment-item";
import { groupComments } from "../thread";
import type { CommentView } from "../types";

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
 *
 * 답글(HODL-60)은 루트 댓글 아래 한 단계만 들여 쓴다. 답글에 답해도 같은 줄에 붙는다.
 * 답글 칸은 한 번에 하나만 열리고, 그 답글이 붙을 자리(그 묶음의 맨 아래)에 둔다.
 * 머리줄 댓글 수는 답글까지 센다(글의 댓글 수와 같다).
 */
export default function CommentSection({ postId, symbol, postAuthorId, verifiable }: Props) {
  const { member } = useSession();
  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => loadComments(postId),
  });
  // 열린 답글 칸 — 답할 댓글과 그 묶음의 루트
  const [replyTo, setReplyTo] = useState<{ rootId: number; comment: CommentView } | null>(null);

  const list = comments.data ?? [];
  const threads = groupComments(list);
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
          {threads.map(({ root, replies }) => {
            const item = (comment: CommentView, replyCount: number) => (
              <CommentItem
                postId={postId}
                symbol={symbol}
                comment={comment}
                byPostAuthor={postAuthorId !== null && comment.memberId === postAuthorId}
                mine={!!member && comment.memberId === member.id}
                replyCount={replyCount}
                replying={replyTo?.comment.id === comment.id}
                onReply={(target) =>
                  setReplyTo((open) =>
                    open?.comment.id === target.id ? null : { rootId: root.id, comment: target },
                  )
                }
              />
            );
            const replyOpen = replyTo?.rootId === root.id;

            return (
              <li key={root.id} className="border-b border-border-subtle last:border-b-0">
                {item(root, replies.length)}
                {replies.length > 0 || replyOpen ? (
                  // 답글은 화살표 + 회색 칸으로 루트와 구분한다(커뮤니티 게시판에 흔한 모양).
                  // 왼쪽 세로줄은 인용처럼 보여서 쓰지 않는다.
                  <div className="mb-4 flex flex-col gap-2 pl-1 sm:pl-3">
                    {replies.length > 0 ? (
                      <ul aria-label={`답글 ${replies.length}개`} className="flex flex-col gap-2">
                        {replies.map((reply) => (
                          <li key={reply.id} className="flex items-start gap-1.5">
                            <ReplyArrow />
                            <div className="min-w-0 flex-1 rounded-sm bg-surface-muted px-4">
                              {item(reply, 0)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {replyOpen && replyTo ? (
                      <div className="flex items-start gap-1.5">
                        <ReplyArrow />
                        <div className="min-w-0 flex-1">
                          <CommentForm
                            postId={postId}
                            verifiable={verifiable}
                            replyTo={{
                              commentId: replyTo.comment.id,
                              nickname: replyTo.comment.nickname,
                            }}
                            onClose={() => setReplyTo(null)}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* 목록이 오래된 순이라 새 댓글이 붙는 맨 아래에 입력칸을 둔다. */}
      <div className="mt-4">
        <CommentForm postId={postId} verifiable={verifiable} />
      </div>
    </section>
  );
}

/** 답글 줄 왼쪽의 ↳. 닉네임 줄 높이에 맞춘다. 읽어 줄 내용이 없어 화면 낭독기에서는 숨긴다. */
function ReplyArrow() {
  return (
    <CornerDownRight
      aria-hidden
      className="mt-[18px] size-4 shrink-0 text-text-muted"
      strokeWidth={1.75}
    />
  );
}
