import { markdownToPlainText } from "@/lib/format/plain-text";
import { postHref, profileHref } from "@/lib/routes";
import type { PostDetail } from "./types";

/** 검색 결과 · 공유 카드에 쓸 본문 요약 길이. 구글이 보통 이 정도에서 자른다. */
const DESCRIPTION_LENGTH = 150;

/** 글 본문 → 한 줄 요약. 길면 자르고 말줄임표를 붙인다. 본문이 비면 제목을 쓴다. */
export function postDescription(post: PostDetail): string {
  const text = markdownToPlainText(post.content) || post.title;
  if (text.length <= DESCRIPTION_LENGTH) return text;
  return `${text.slice(0, DESCRIPTION_LENGTH - 1).trimEnd()}…`;
}

/** 이 글의 대표 주소. 주소창의 방 이름이 달라도 글이 속한 방으로 맞춘다. */
export function postCanonicalPath(post: PostDetail): string {
  return postHref(post.coinSymbol, post.id);
}

/**
 * 글 상세의 구조화 데이터(JSON-LD). 구글이 커뮤니티 글로 알아보는 `DiscussionForumPosting`.
 *
 * 화면에 보이는 것만 넣는다. 보유 인증 · 수량 구간은 넣지 않는다 — 구조화 데이터로 모아
 * 가기 쉬운 형태로 내보낼 이유가 없다.
 */
export function postStructuredData(post: PostDetail, origin: string) {
  const url = `${origin}${postCanonicalPath(post)}`;
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": url,
    url,
    headline: post.title,
    text: markdownToPlainText(post.content),
    datePublished: post.createdAt || undefined,
    author: {
      "@type": "Person",
      name: post.authorNickname,
      url: post.authorId !== null ? `${origin}${profileHref(post.authorId)}` : undefined,
    },
    image:
      post.images.length > 0
        ? post.images.map((image) => new URL(image.src, origin).href)
        : undefined,
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.likes,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.comments,
      },
    ],
  };
}
