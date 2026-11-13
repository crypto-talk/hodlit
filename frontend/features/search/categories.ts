import type { SearchCategory } from "./types";

/**
 * 검색 결과 분류 (HODL-100). 전체 검색은 글 · 댓글 · 방 · 사용자, 방 안 검색은 글 · 댓글만이다.
 * 방 검색에 방 · 사용자 분류를 보내면 서버가 400 을 준다. 그래서 주소 값을 여기서 먼저 거른다.
 */
export const CATEGORY_LABEL: Record<SearchCategory, string> = {
  posts: "글",
  comments: "댓글",
  rooms: "방",
  users: "사용자",
};

const ALL: SearchCategory[] = ["posts", "comments", "rooms", "users"];
const IN_ROOM: SearchCategory[] = ["posts", "comments"];

/** 그 범위에서 고를 수 있는 분류. 화면에 놓는 순서이기도 하다. */
export function categoriesFor(room: string | null): SearchCategory[] {
  return room ? IN_ROOM : ALL;
}

/** 주소의 `type`. 모르는 값이나 그 범위에 없는 분류는 null(= 분류별 미리보기 화면). */
export function parseCategory(
  value: string | undefined,
  room: string | null,
): SearchCategory | null {
  return categoriesFor(room).find((category) => category === value) ?? null;
}
