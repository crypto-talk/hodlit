/**
 * 글 상세 쿼리 키.
 *
 * 보는 사람(회원 id)이 키에 들어간다. 좋아요 · 북마크 여부가 요청에 실린 토큰에
 * 따라 달라지기 때문이다. 로그인하거나 로그아웃하면 키가 바뀌어 다시 받는다.
 *
 * 댓글 쪽은 `["post", postId]` 로 무효화한다. 앞부분이 같아서 이 키도 함께 걸린다.
 *
 * 서버 컴포넌트(글 상세 페이지)도 이 키로 미리 받은 글을 넘기므로 `"use client"` 파일
 * 밖에 둔다. 클라이언트 파일의 함수는 서버에서 부를 수 없다.
 */
export function postQueryKey(postId: number, viewerId: number | null) {
  return ["post", postId, viewerId] as const;
}
