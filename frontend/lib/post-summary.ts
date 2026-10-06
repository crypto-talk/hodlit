import type { components } from "@/lib/api-schema";
import { markdownToPlainText } from "@/lib/format/plain-text";
import { formatRelativeTime } from "@/lib/format/time";
import { postHref } from "@/lib/routes";
import type { Tier } from "@/lib/holder-snapshot/types";

import {
  UNSUPPORTED_LABEL,
  holdingPeriodLabel,
  isVerifiable,
  tierOf,
} from "@/lib/holder-snapshot/label";

/**
 * 글 목록 한 줄 (랜딩 전체 글 · 방 게시판).
 *
 * 랜딩의 `toFeedPost` 를 여기로 내렸다. 방 게시판도 같은 카드를 그리는데
 * features 끼리는 참조할 수 없어서(구조 규칙 1) 공용으로 왔다. 카드 모양은
 * `components/post/post-card.tsx` 다.
 *
 * 화면 요소가 없는 변환 함수라 `lib/` 에 있다. 보유 문구는 여기서도 직접 만들지
 * 않고 `lib/holder-snapshot/label.ts` 를 부른다(구조 규칙 3).
 */

type PostResponse = components["schemas"]["PostResponse"];

/** id 가 확인된 글. 목록 key 로 쓰므로 부르는 쪽이 보장한다. */
export type IdentifiedPost = PostResponse & { id: number };

export type PostSummary = {
  id: number;
  /** 글 상세 주소. */
  href: string;
  /** 보유 인증을 지원하는 코인의 글인지. false 면 인증 배지를 그리지 않는다. */
  verifiable: boolean;
  symbol: string;
  tier: Tier;
  /** 수량 구간. **서버가 완성해서 주는 문자열**이다. 프론트가 계산하지 않는다. */
  range: string;
  /** ISO 시각. `<time dateTime>` 에 넣는다. */
  createdAt: string;
  time: string;
  title: string;
  preview: string;
  nick: string;
  /** 보유 기간 문구. 인덱서 전까지 항상 `보유 기간 미확인`. 미지원 코인이면 그 사실. */
  hold: string;
  comments: number;
  /** ⚠️ 조회수 API 가 없다. null 이면 화면에서 자리를 뺀다. */
  views: number | null;
};

const PREVIEW_LENGTH = 120;

export function hasPostId(post: PostResponse | undefined): post is IdentifiedPost {
  return typeof post?.id === "number";
}

export function toPostSummary(post: IdentifiedPost): PostSummary {
  const snapshot = post.holderSnapshot;
  const verifiable = isVerifiable(snapshot?.verificationAvailability);

  return {
    id: post.id,
    href: postHref(post.coinSymbol ?? "", post.id),
    verifiable,
    symbol: post.coinSymbol ?? "",
    tier: tierOf(snapshot?.verificationLevel, post.verifiedHolder),
    // 서버가 완성해서 주는 문자열이다. 여기서 수량으로 다시 계산하지 않는다.
    range: snapshot?.quantityBand ?? "",
    createdAt: post.createdAt ?? "",
    time: formatRelativeTime(post.createdAt),
    title: post.title ?? "(제목 없음)",
    preview: toPreview(post.content),
    nick: post.author?.nickname ?? "알 수 없음",
    // 인증을 지원하지 않는 코인이면 "보유 기간 미확인" 대신 그 사실을 말한다.
    hold: verifiable ? holdingPeriodLabel(snapshot?.holdingMonths) : UNSUPPORTED_LABEL,
    comments: post.comments ?? 0,
    // 조회수 API 가 없다. 숫자를 지어내지 않고 화면에서 자리를 뺀다(G-5).
    views: null,
  };
}

/** 본문은 Markdown 이다. 기호를 걷어낸 평문을 자른다. */
function toPreview(content: string | undefined): string {
  const text = markdownToPlainText(content ?? "");
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}
