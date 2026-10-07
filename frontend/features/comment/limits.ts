/**
 * 댓글 길이 제한.
 *
 * 백엔드 `CommentController.CreateCommentRequest` · `UpdateCommentRequest` 의
 * `@Size(max=1000)` 과 같은 값이다. 백엔드가 바꾸면 여기도 같이 바꾼다.
 * 서버는 앞뒤 공백을 잘라 저장하고, 빈 댓글은 `@NotBlank` 로 거른다.
 */
export const COMMENT_MAX = 1000;

/** 보낼 수 없는 댓글이면 그 이유, 괜찮으면 null. */
export function commentProblem(content: string): string | null {
  if (content.trim().length === 0) return "댓글 내용을 입력해 주세요.";
  if (content.trim().length > COMMENT_MAX) return `댓글은 ${COMMENT_MAX}자까지 쓸 수 있습니다.`;
  return null;
}
