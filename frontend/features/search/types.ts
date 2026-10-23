/**
 * 검색 결과 뷰 모델 (HODL-65 전체 · HODL-69 방).
 *
 * 백엔드 DTO 는 `lib/api-schema.ts` 의 `SearchItem` 이다. 종류(`type`)마다 쓰는 필드가 달라
 * `api.ts` 에서 종류별 모양으로 좁힌다. 화면 key 는 `key`(종류 + id) — 종류가 다르면 id 가 겹칠 수 있다.
 */

export type SearchResult =
  | {
      kind: "post";
      key: string;
      postId: number;
      symbol: string;
      title: string;
      /** 본문 앞부분 평문(Markdown 기호를 걷어냄). 서버가 200자에서 자른다. */
      excerpt: string;
      author: string;
      createdAt: string;
    }
  | {
      kind: "comment";
      key: string;
      commentId: number;
      postId: number;
      symbol: string;
      /** 댓글이 달린 글 제목. 보여 주기만 하고 검색 대상은 아니다. */
      postTitle: string;
      excerpt: string;
      author: string;
      createdAt: string;
    }
  | { kind: "room"; key: string; symbol: string; name: string }
  | { kind: "user"; key: string; memberId: number; nickname: string };

export type SearchPage = {
  results: SearchResult[];
  totalElements: number;
  totalPages: number;
};
