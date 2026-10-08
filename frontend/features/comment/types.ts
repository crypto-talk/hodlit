import type { Tier } from "@/lib/holder-snapshot/types";

/**
 * 댓글 뷰 모델.
 *
 * 백엔드 DTO 는 `lib/api-schema.ts` 의 `CommentResponse` 다. 응답 타입은 모든 필드가
 * 선택(`?`)이라 `api.ts` 에서 한 번 좁혀 여기 모양으로 넘긴다.
 */

/**
 * 댓글에 붙은 보유 정보를 화면 문구로 바꾼 것. 문구는 `lib/holder-snapshot/label.ts` 가
 * 만든다(구조 규칙 3).
 *
 * ⚠️ 수량 구간이 없다. 글은 주장이라 얼마를 걸었는지가 필요하지만, 댓글은 반응이라
 * 오래 봤는지면 충분하다. 댓글마다 금액이 붙으면 금액 순으로 권위가 생긴다.
 * 서버 응답에도 `quantityBand` 가 없다.
 */
export type CommentHolderView = {
  /** 이 코인이 보유 인증을 지원하는지. false 면 배지 · 기간을 그리지 않는다. */
  verifiable: boolean;
  tier: Tier;
  holding: string;
};

export type CommentView = {
  id: number;
  memberId: number | null;
  nickname: string;
  content: string;
  createdAt: string;
  /** 작성 후 내용을 고친 적이 있으면 true. 보유 정보는 작성 시점 그대로다. */
  edited: boolean;
  /** 작성 시점에 고정된 보유 정보. 응답에 없으면 null. */
  holder: CommentHolderView | null;
};
