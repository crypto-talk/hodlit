"use client";

import { useQuery } from "@tanstack/react-query";
import CommentSection from "@/features/comment/components/comment-section";
import { loadPost } from "@/features/post/api";
import PostDetailView from "@/features/post/components/post-detail";

type Props = {
  postId: number;
  symbol: string;
};

/**
 * 글 상세 + 댓글을 조합한다.
 *
 * 둘은 다른 feature(`post` · `comment`)라 서로 참조할 수 없다(구조 규칙 1). 댓글이
 * 알아야 하는 글 정보(글쓴이 id, 방의 보유 인증 지원 여부)를 여기서 꺼내 넘긴다.
 * 같은 쿼리 키 `["post", id]` 라 글을 두 번 받지 않는다.
 *
 * 글이 아직 없거나 못 불러왔으면 댓글을 그리지 않는다 — 그 안내는 글 쪽이 한다.
 */
export default function PostView({ postId, symbol }: Props) {
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => loadPost(postId) });

  return (
    <div className="flex flex-col gap-4">
      <PostDetailView postId={postId} symbol={symbol} />
      {post.data ? (
        <CommentSection
          postId={postId}
          postAuthorId={post.data.authorId}
          verifiable={post.data.holder?.verifiable ?? false}
        />
      ) : null}
    </div>
  );
}
