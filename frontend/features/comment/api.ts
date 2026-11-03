import type { components } from "@/lib/api-schema";
import { holdingPeriodLabel, isVerifiable, tierOf } from "@/lib/holder-snapshot/label";
import { http } from "@/lib/http";
import type { CommentView } from "./types";

/**
 * 댓글 (구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * ⚠️ `lib/api-schema.ts` 의 응답 타입은 모든 필드가 선택(`?`)이다. 여기서 한 번
 * 좁히고, 화면은 좁혀진 뷰 모델만 받는다.
 *
 * 수정 · 삭제는 서버가 작성자인지 검사한다(`PostService.own()`, 아니면 403).
 * 화면이 버튼을 작성자에게만 보여주는 것은 편의일 뿐이다.
 */

type CommentResponse = components["schemas"]["CommentResponse"];
type CreateCommentRequest = components["schemas"]["CreateCommentRequest"];
type UpdateCommentRequest = components["schemas"]["UpdateCommentRequest"];

/**
 * 글의 댓글 전부. 공개 API 라 로그인 없이도 열린다.
 *
 * 서버가 작성 시각 오래된 순으로 준다. 페이지가 없어 한 번에 전부 온다.
 * 글이 없으면 404.
 */
export async function loadComments(postId: number): Promise<CommentView[]> {
  const comments = await http<CommentResponse[]>(`/api/v1/posts/${postId}/comments`);
  return comments.filter(hasId).map(toCommentView);
}

/**
 * 댓글 · 답글 작성.
 *
 * 답글이면 누른 댓글의 id 를 `replyToCommentId` 로 보낸다. 그 댓글이 답글이어도 그대로 보내면
 * 서버가 같은 루트 아래에 붙인다(3단으로 내려가지 않는다, HODL-60). 다른 글의 댓글이면 400,
 * 이미 지워진 댓글이면 404.
 *
 * 보유 정보는 보내지 않는다. 서버가 저장하면서 보유 기록을 새로 읽어 댓글에 붙인다(HODL-45).
 */
export async function createComment(input: {
  postId: number;
  content: string;
  replyToCommentId?: number;
}): Promise<void> {
  const body: CreateCommentRequest = { content: input.content.trim() };
  if (input.replyToCommentId !== undefined) body.replyToCommentId = input.replyToCommentId;
  await http<CommentResponse>(`/api/v1/posts/${input.postId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 댓글 내용 수정. 보유 정보는 작성 시점 그대로고 바뀌지 않는다. */
export async function updateComment(input: { commentId: number; content: string }): Promise<void> {
  const body: UpdateCommentRequest = { content: input.content.trim() };
  await http<CommentResponse>(`/api/v1/comments/${input.commentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * 댓글 삭제. 서버는 기록을 남기지 않고 지운다.
 * ⚠️ 루트 댓글을 지우면 그 아래 답글도 함께 지워진다(DB `ON DELETE CASCADE`). 그래서 삭제 확인에
 * 답글 수를 같이 알린다. 답글을 지우면 다른 답글은 남고, 그 답글에 답한 댓글의
 * `replyToCommentId` 만 null 이 된다(`@닉네임` 은 남는다).
 */
export async function deleteComment(commentId: number): Promise<void> {
  await http<void>(`/api/v1/comments/${commentId}`, { method: "DELETE" });
}

/** 응답 한 건을 뷰 모델로. 테스트에서 쓰려고 내보낸다. */
export function toCommentView(comment: CommentResponse & { id: number }): CommentView {
  const createdAt = comment.createdAt ?? "";
  const snapshot = comment.holderSnapshot;

  return {
    id: comment.id,
    memberId: comment.memberId ?? null,
    nickname: comment.nickname ?? "알 수 없음",
    content: comment.content ?? "",
    createdAt,
    // 서버는 작성할 때 updatedAt 을 createdAt 과 같은 값으로 채운다.
    edited:
      !!comment.updatedAt &&
      !!createdAt &&
      new Date(comment.updatedAt).getTime() - new Date(createdAt).getTime() > 1_000,
    holder: snapshot
      ? {
          verifiable: isVerifiable(snapshot.verificationAvailability),
          tier: tierOf(snapshot.verificationLevel, snapshot.verifiedHolder, snapshot.holderStatus),
          holding: holdingPeriodLabel(snapshot.holdingMonths),
          badge: (
            snapshot as { badge?: import("@/components/holder/animal-badge").AnimalBadgeData }
          ).badge,
          partial: snapshot.syncStatus === "PARTIAL",
          holderStatus: snapshot.holderStatus,
        }
      : null,
    // null 필드는 응답에서 아예 빠진다(`non_null`). 예전 댓글(답글 기능 전)은 셋 다 없는 루트다.
    parentCommentId: comment.parentCommentId ?? null,
    replyToCommentId: comment.replyToCommentId ?? null,
    replyToNickname: comment.replyToNickname?.trim() ? comment.replyToNickname : null,
  };
}

function hasId(comment: CommentResponse): comment is CommentResponse & { id: number } {
  return typeof comment.id === "number";
}
