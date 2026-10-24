/**
 * 검색어 제한. 백엔드 `SearchService.validate` 와 같은 값이다 — 앞뒤 공백을 자르고 1~100자.
 * 서버는 Java `String.length()`(UTF-16 단위)로 센다. 여기도 `.length` 로 맞춘다.
 */
export const SEARCH_MAX = 100;

/** 한 쪽에 보일 결과 수. 방 게시판과 같다. */
export const SEARCH_PAGE_SIZE = 20;

/** 보낼 수 없는 검색어면 그 이유, 괜찮으면 null. */
export function searchProblem(q: string): string | null {
  const trimmed = q.trim();
  if (trimmed.length === 0) return "검색어를 입력해 주세요.";
  if (trimmed.length > SEARCH_MAX) return `검색어는 ${SEARCH_MAX}자까지 쓸 수 있습니다.`;
  return null;
}
