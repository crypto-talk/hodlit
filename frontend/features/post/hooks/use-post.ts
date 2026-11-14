"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { loadPost } from "../api";
import { postQueryKey } from "../query-key";

/** 비로그인이 서버에서 받은 글을 새것으로 보는 시간. 이 안에서는 브라우저가 다시 받지 않는다. */
const GUEST_FRESH_MS = 60_000;

/**
 * 글 상세. 글 본문과 상세 페이지(댓글을 붙이는 쪽)가 같은 키를 써서 한 번만 받는다.
 *
 * 세션 복원(`refresh` 쿠키)이 끝난 뒤에 부른다. 먼저 부르면 토큰 없이 나가서
 * 이미 누른 좋아요가 꺼진 채로 보였다가 다시 켜진다.
 *
 * 글 상세 페이지는 서버에서 비로그인으로 받은 글을 `["post", id, null]` 에 넣어 둔다
 * (검색엔진 · AI 크롤러가 본문을 읽게).
 *   - 비로그인: 방금 서버가 받은 것과 같은 글이라 다시 받지 않는다(`GUEST_FRESH_MS`)
 *   - 로그인: 키가 바뀌어 자기 좋아요 · 북마크 여부를 다시 받는다. 그동안 서버가 그린 글을
 *     그대로 보여 주고(`keepPreviousData`), 아직 모르는 값이라 글 상세가 버튼을 잠근다.
 *     토큰이 쿠키로 옮겨지면(B-3) 서버가 처음부터 로그인 상태로 받아 이 한 번이 없어진다
 */
export function usePost(postId: number) {
  const { member, restored } = useSession();
  const viewerId = member?.id ?? null;

  return useQuery({
    queryKey: postQueryKey(postId, viewerId),
    queryFn: () => loadPost(postId),
    enabled: restored,
    staleTime: viewerId === null ? GUEST_FRESH_MS : 0,
    placeholderData: keepPreviousData,
  });
}
