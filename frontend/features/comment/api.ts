import type { components } from "@/lib/api-schema";
import { holdingPeriodLabel, isVerifiable, tierOf } from "@/lib/holder-snapshot/label";
import { refreshHoldings } from "@/lib/holdings-refresh";
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
  return comments.filter(hasId).map(toView);
}

/**
 * 댓글 작성.
 *
 * 보유 정보는 보내지 않는다. 서버가 저장해 둔 보유 기록을 댓글에 복사한다. 글과 같은
 * 이유로 인증 지원 방(`verifiable`)이면 보내기 직전에 기록을 갱신한다
 * (`lib/holdings-refresh.ts`, HODL-45 전까지의 임시 조치).
 */
export async function createComment(input: {
  postId: number;
  content: string;
  verifiable: boolean;
}): Promise<void> {
  if (input.verifiable) await refreshHoldings();

  const body: CreateCommentRequest = { content: input.content.trim() };
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

/** 댓글 삭제. 서버는 기록을 남기지 않고 지운다(답글이 없어서 자리를 남길 이유가 없다). */
export async function deleteComment(commentId: number): Promise<void> {
  await http<void>(`/api/v1/comments/${commentId}`, { method: "DELETE" });
}

function toView(comment: CommentResponse & { id: number }): CommentView {
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
          tier: tierOf(snapshot.verificationLevel, snapshot.verifiedHolder, snapshot.walletCount),
          holding: holdingPeriodLabel(snapshot.holdingMonths),
        }
      : null,
  };
}

function hasId(comment: CommentResponse): comment is CommentResponse & { id: number } {
  return typeof comment.id === "number";
}
