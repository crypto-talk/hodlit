import type { CommentView } from "./types";

/**
 * 댓글 하나와 그 아래 답글들. 답글은 한 단계만 있다(HODL-60).
 *
 * 서버는 답글에 답해도 3단으로 내려가지 않고 같은 루트 아래 형제로 붙인다
 * (`parentCommentId` = 루트, `replyToCommentId` = 실제로 답한 댓글).
 */
export type CommentThread = {
  root: CommentView;
  replies: CommentView[];
};

/**
 * 서버가 준 평평한 목록(작성 시각 오래된 순)을 루트별로 묶는다.
 *
 * - 루트 순서와 답글 순서는 서버 순서를 그대로 따른다.
 * - 루트가 목록에 없는 답글은 버리지 않고 루트처럼 그린다. 루트를 지우면 서버가 답글도
 *   함께 지우므로 정상이라면 생기지 않지만, 응답 사이에 루트만 지워진 경우 등에서
 *   댓글이 조용히 사라지는 것보다 평평하게 보이는 편이 낫다.
 */
export function groupComments(comments: CommentView[]): CommentThread[] {
  const rootIds = new Set(
    comments.filter((comment) => comment.parentCommentId === null).map((comment) => comment.id),
  );
  const threads: CommentThread[] = [];
  const byRoot = new Map<number, CommentThread>();

  for (const comment of comments) {
    const parentId = comment.parentCommentId;
    if (parentId !== null && rootIds.has(parentId)) continue;
    const thread = { root: comment, replies: [] };
    threads.push(thread);
    byRoot.set(comment.id, thread);
  }

  for (const comment of comments) {
    const parentId = comment.parentCommentId;
    if (parentId === null || !rootIds.has(parentId)) continue;
    byRoot.get(parentId)?.replies.push(comment);
  }

  return threads;
}
