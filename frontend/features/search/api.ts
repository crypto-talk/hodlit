import type { components } from "@/lib/api-schema";
import { coinNameKo } from "@/lib/coin-name-ko";
import { markdownToPlainText } from "@/lib/format/plain-text";
import { http } from "@/lib/http";
import { safeSymbol } from "@/lib/routes";
import { SEARCH_PAGE_SIZE } from "./limits";
import type { SearchPage, SearchResult } from "./types";

/**
 * 검색 (구조 규칙 2: 데이터 진입점은 여기 하나). 공개 API 라 로그인 없이 된다.
 *
 * - 전체: `GET /search` — 글 · 댓글 · 방 · 사용자 (HODL-65)
 * - 방: `GET /communities/{symbol}/search` — 그 방의 글 · 댓글만 (HODL-69). 없거나 운영 중이 아닌 방은 404
 *
 * 둘 다 관련도순(제목 3 · 닉네임 2 · 본문 1 을 더한 점수) → 최신순이고, 검색어 전체가 들어 있는지만 본다
 * (단어 · 형태소 검색 아님). 운영 중인 방의 글 · 댓글만 나온다.
 */

type Schemas = components["schemas"];
type SearchItem = Schemas["SearchItem"];
type SearchPageResponse = Schemas["PageResponseSearchItem"];

/** `page` 는 화면 기준 1부터다. API 는 0부터라 여기서 하나 뺀다. */
export async function loadSearch(input: {
  q: string;
  page: number;
  room: string | null;
}): Promise<SearchPage> {
  const query = new URLSearchParams({
    q: input.q.trim(),
    page: String(Math.max(0, input.page - 1)),
    size: String(SEARCH_PAGE_SIZE),
  });
  const path = input.room
    ? `/api/v1/communities/${encodeURIComponent(input.room)}/search`
    : "/api/v1/search";
  const result = await http<SearchPageResponse>(`${path}?${query}`);

  return {
    results: (result.items ?? []).flatMap((item) => {
      const view = toSearchResult(item);
      return view ? [view] : [];
    }),
    totalElements: result.totalElements ?? 0,
    totalPages: result.totalPages ?? 0,
  };
}

/**
 * 응답 한 건을 종류별 모양으로. 이동할 곳을 만들 수 없는 항목(방 기호가 없는 글 등)과 모르는 종류는 버린다.
 * 테스트에서 쓰려고 내보낸다.
 */
export function toSearchResult(item: SearchItem): SearchResult | null {
  const id = item.id;
  if (typeof id !== "number") return null;
  const symbol = safeSymbol(item.roomSymbol ?? undefined);

  switch (item.type) {
    case "POST": {
      if (!symbol) return null;
      return {
        kind: "post",
        key: `POST-${id}`,
        postId: item.postId ?? id,
        symbol,
        title: item.label || "(제목 없음)",
        // 글 본문은 Markdown 이고 서버가 원문 앞 200자를 자른 것이라 기호를 걷어낸다.
        excerpt: markdownToPlainText(item.excerpt ?? ""),
        author: item.authorNickname ?? "알 수 없음",
        createdAt: item.createdAt ?? "",
      };
    }
    case "COMMENT": {
      if (!symbol || typeof item.postId !== "number") return null;
      return {
        kind: "comment",
        key: `COMMENT-${id}`,
        commentId: id,
        postId: item.postId,
        symbol,
        postTitle: item.label || "(제목 없음)",
        excerpt: item.excerpt ?? "",
        author: item.authorNickname ?? "알 수 없음",
        createdAt: item.createdAt ?? "",
      };
    }
    case "ROOM": {
      if (!symbol) return null;
      return {
        kind: "room",
        key: `ROOM-${id}`,
        symbol,
        name: coinNameKo(symbol, item.label || symbol),
      };
    }
    case "USER": {
      if (!item.label) return null;
      return { kind: "user", key: `USER-${id}`, memberId: id, nickname: item.label };
    }
    default:
      return null;
  }
}
