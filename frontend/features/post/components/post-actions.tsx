"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart } from "lucide-react";
import { useState } from "react";
import { useRequireLogin, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { setBookmarked, setLiked } from "../api";
import { postQueryKey } from "../hooks/use-post";
import type { PostDetail, PostReactions } from "../types";

type Props = {
  postId: number;
  reactions: PostReactions;
  comments: number;
};

type Kind = "like" | "bookmark";

/** 켜기 · 끄기 직후 화면에 먼저 그릴 값. 서버 응답이 오면 그 값으로 덮는다. */
function toggled(current: PostReactions, kind: Kind): PostReactions {
  if (kind === "bookmark") return { ...current, bookmarked: !current.bookmarked };
  return {
    ...current,
    liked: !current.liked,
    likes: Math.max(0, current.likes + (current.liked ? -1 : 1)),
  };
}

const BUTTON =
  "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60";
const OFF = "border-border-subtle text-text-muted hover:text-text-primary";
const ON = "border-brand text-brand";

/**
 * 글 상세 맨 아래의 좋아요 · 북마크.
 *
 * 누르면 바로 바뀐 모양을 그리고(낙관적 갱신), 서버 응답의 숫자로 맞춘다. 실패하면
 * 누르기 전으로 돌리고 버튼 옆에 한 줄 알린다.
 *
 * 로그인 전에 누르면 `/login?next=` 로 보낸다. 재게시는 이번 범위에서 뺐다.
 */
export default function PostActions({ postId, reactions, comments }: Props) {
  const queryClient = useQueryClient();
  const { member } = useSession();
  const requireLogin = useRequireLogin();
  const [error, setError] = useState("");
  const key = postQueryKey(postId, member?.id ?? null);

  const patch = (next: PostReactions) =>
    queryClient.setQueryData<PostDetail>(key, (post) => (post ? { ...post, ...next } : post));

  const mutation = useMutation({
    mutationFn: ({ kind, on }: { kind: Kind; on: boolean }) =>
      kind === "like" ? setLiked(postId, on) : setBookmarked(postId, on),
    onMutate: ({ kind }) => {
      setError("");
      const before = reactions;
      patch(toggled(before, kind));
      return { before };
    },
    onSuccess: (next, { kind }) => {
      patch(next);
      if (kind === "bookmark") void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onError: (_reason, { kind }, context) => {
      if (context) patch(context.before);
      setError(kind === "like" ? "좋아요를 반영하지 못했습니다." : "북마크를 반영하지 못했습니다.");
    },
  });

  const press = (kind: Kind) => {
    if (requireLogin()) return;
    const on = kind === "like" ? !reactions.liked : !reactions.bookmarked;
    mutation.mutate({ kind, on });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={reactions.liked}
        disabled={mutation.isPending}
        className={cn(BUTTON, reactions.liked ? ON : OFF)}
        onClick={() => press("like")}
      >
        <Heart className="size-4" fill={reactions.liked ? "currentColor" : "none"} aria-hidden />
        좋아요 <span className="tabular-nums">{reactions.likes}</span>
      </button>
      <button
        type="button"
        aria-pressed={reactions.bookmarked}
        disabled={mutation.isPending}
        className={cn(BUTTON, reactions.bookmarked ? ON : OFF)}
        onClick={() => press("bookmark")}
      >
        <Bookmark
          className="size-4"
          fill={reactions.bookmarked ? "currentColor" : "none"}
          aria-hidden
        />
        북마크
      </button>
      <span className="text-sm text-text-muted tabular-nums">댓글 {comments}</span>
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
