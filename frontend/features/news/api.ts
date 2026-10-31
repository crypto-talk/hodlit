import type { components } from "@/lib/api-schema";
import { http } from "@/lib/http";
import type { RoomNewsItem, RoomNewsPage } from "./types";

/**
 * 방 뉴스 (HODL-62, `docs/COMMUNITY_NEWS_API.md`). 구조 규칙 2: 데이터 진입점은 여기 하나.
 *
 * 뉴스는 관리자가 제목 · 짧은 요약 · 출처 이름 · 원문 링크를 직접 등록한다. 서비스는 원문을 가져오지 않는다.
 * 화면은 그 네 가지만 평문으로 그리고, 원문은 바깥 링크로 연다.
 *
 * ⚠️ 생성 타입은 모든 필드가 선택(`?`)이다. 여기서 한 번 좁힌다.
 */

type NewsResponse = components["schemas"]["NewsResponse"];
type NewsPageResponse = components["schemas"]["PageResponseNewsResponse"];

/** 방 게시판 뉴스 칸에 보여 주는 수. 제목 한 줄씩, 투표 칸과 높이를 맞춘다. 나머지는 뉴스 페이지에서. */
export const ROOM_NEWS_PREVIEW_SIZE = 3;

/** 뉴스 페이지 한 쪽의 수. 백엔드 번호 페이지 기본값과 같다. */
export const NEWS_PAGE_SIZE = 20;

export function roomNewsQueryKey(symbol: string, page: number, size: number) {
  return ["room-news", symbol, page, size] as const;
}

/** `page` 는 화면 기준 1부터. API 는 0부터라 하나 뺀다. 최신순은 서버가 정한다. */
export async function loadRoomNews(
  symbol: string,
  page: number,
  size: number,
): Promise<RoomNewsPage> {
  const query = new URLSearchParams({
    page: String(Math.max(0, page - 1)),
    size: String(size),
  });
  const result = await http<NewsPageResponse>(
    `/api/v1/communities/${encodeURIComponent(symbol)}/news?${query}`,
  );

  return {
    items: (result.items ?? []).flatMap((item) => {
      const news = toNewsItem(item);
      return news ? [news] : [];
    }),
    page,
    totalPages: result.totalPages ?? 0,
    totalItems: result.totalElements ?? 0,
  };
}

/** 제목이 없는 항목은 그리지 않는다. 원문 주소는 http(s) 일 때만 링크로 쓴다. */
export function toNewsItem(raw: NewsResponse): RoomNewsItem | null {
  if (typeof raw.id !== "number" || !raw.title) return null;
  return {
    id: raw.id,
    title: raw.title,
    summary: raw.summary ?? "",
    sourceName: raw.sourceName ?? "",
    sourceUrl: safeExternalUrl(raw.sourceUrl),
    createdAt: raw.createdAt ?? "",
  };
}

/**
 * 바깥 링크로 써도 되는 주소인지. 서버도 http(s) 만 받지만, `javascript:` 같은 주소가
 * href 에 들어가면 바로 스크립트가 되니 화면 쪽에서도 한 번 더 막는다.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
