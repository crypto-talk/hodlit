"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { loadPost } from "../api";
import { postQueryKey } from "../query-key";

/**
 * 글 상세. 글 본문과 상세 페이지(댓글을 붙이는 쪽)가 같은 키를 써서 한 번만 받는다.
 *
 * 세션 복원(`refresh` 쿠키)이 끝난 뒤에 부른다. 먼저 부르면 토큰 없이 나가서
 * 이미 누른 좋아요가 꺼진 채로 보였다가 다시 켜진다.
 *
 * 글 상세 페이지는 서버에서 비로그인으로 받은 글을 `["post", id, null]` 에 넣어 둔다
 * (검색엔진 · AI 크롤러가 본문을 읽게). 로그인 회원은 키가 바뀌어 다시 받는 동안 그 글을
 * 그대로 보여 준다(`keepPreviousData`). 그동안 좋아요 · 북마크 여부는 아직 모르는 값이라
 * 글 상세가 버튼을 잠근다.
 */
export function usePost(postId: number) {
  const { member, restored } = useSession();
  const viewerId = member?.id ?? null;

  return useQuery({
    queryKey: postQueryKey(postId, viewerId),
    queryFn: () => loadPost(postId),
    enabled: restored,
    placeholderData: keepPreviousData,
  });
}
