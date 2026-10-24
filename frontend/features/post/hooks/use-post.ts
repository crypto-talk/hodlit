"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { loadPost } from "../api";

/**
 * 글 상세 쿼리 키.
 *
 * 보는 사람(회원 id)이 키에 들어간다. 좋아요 · 북마크 여부가 요청에 실린 토큰에
 * 따라 달라지기 때문이다. 로그인하거나 로그아웃하면 키가 바뀌어 다시 받는다.
 *
 * 댓글 쪽은 `["post", postId]` 로 무효화한다. 앞부분이 같아서 이 키도 함께 걸린다.
 */
export function postQueryKey(postId: number, viewerId: number | null) {
  return ["post", postId, viewerId] as const;
}

/**
 * 글 상세. 글 본문과 상세 페이지(댓글을 붙이는 쪽)가 같은 키를 써서 한 번만 받는다.
 *
 * 세션 복원(`refresh` 쿠키)이 끝난 뒤에 부른다. 먼저 부르면 토큰 없이 나가서
 * 이미 누른 좋아요가 꺼진 채로 보였다가 다시 켜진다.
 */
export function usePost(postId: number) {
  const { member, restored } = useSession();
  const viewerId = member?.id ?? null;

  return useQuery({
    queryKey: postQueryKey(postId, viewerId),
    queryFn: () => loadPost(postId),
    enabled: restored,
  });
}
