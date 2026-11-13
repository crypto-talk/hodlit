/**
 * 화면 주소를 만드는 곳.
 *
 * 글 주소는 랜딩·방 게시판·글쓰기(발행 후 이동)가 모두 쓴다. 각자 문자열을
 * 조립하면 한쪽만 바뀌는 일이 생겨서 여기 둔다. features 끼리는 참조할 수
 * 없으므로(구조 규칙 1) lib 에 있다.
 */

/** 방 심볼로 받아들일 모양. 주소나 `?symbol=` 을 그대로 믿지 않으려고 둔다. */
const SYMBOL_PATTERN = /^[A-Z0-9]{1,10}$/;

/**
 * 방 심볼 검사. 대문자로 맞춰 돌려주고, 모양이 아니면 null 이다.
 *
 * 글쓰기의 `?symbol=` 과 방 게시판 주소가 같이 쓴다. 예전에는
 * `features/post/limits.ts` 에 있었는데 방 게시판도 필요해서 내려왔다.
 */
export function safeSymbol(value: string | undefined): string | null {
  if (!value) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // `%E0` 처럼 깨진 인코딩. 방 심볼일 수 없다.
    return null;
  }
  const upper = decoded.toUpperCase();
  return SYMBOL_PATTERN.test(upper) ? upper : null;
}

/** 방 게시판. 탭과 쪽 번호는 쿼리스트링이다(구조 규칙 8). `page` 는 1부터 센다. */
export function roomHref(symbol: string, tab?: "verified", page?: number): string {
  const base = `/subhodl/${encodeURIComponent(symbol)}`;
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  // 화면의 쪽 번호는 1부터다. 1쪽은 주소에 적지 않는다.
  if (page && page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}

/**
 * 방 뉴스 목록. 방 게시판 뉴스 칸의 "더보기" 가 여기로 온다. `page` 는 1부터 세고 1쪽은 주소에 적지 않는다.
 * `/subhodl/[symbol]/news` 는 고정 경로라 글 상세(`[postId]`)보다 먼저 잡힌다.
 */
export function newsHref(symbol: string, page?: number): string {
  const base = `/subhodl/${encodeURIComponent(symbol)}/news`;
  return page && page > 1 ? `${base}?page=${page}` : base;
}

/** 글 상세. */
export function postHref(symbol: string, postId: number): string {
  return `/subhodl/${encodeURIComponent(symbol)}/${postId}`;
}

/**
 * 글 상세의 댓글 하나. 댓글 목록이 늦게 오므로 브라우저가 알아서 스크롤하지 못한다 —
 * 목록이 그려진 뒤 `features/comment` 의 댓글 섹션이 이 앵커로 옮긴다.
 */
export function commentHref(symbol: string, postId: number, commentId: number): string {
  return `${postHref(symbol, postId)}#${commentAnchor(commentId)}`;
}

/** 댓글 요소의 id. `commentHref` 와 댓글 화면이 같은 값을 써야 해서 여기 둔다. */
export function commentAnchor(commentId: number): string {
  return `comment-${commentId}`;
}

/**
 * 검색 결과 화면. `room` 이 있으면 그 방 안에서만(글 · 댓글) 찾는다.
 * `page` 는 1부터 세고 1쪽은 주소에 적지 않는다.
 */
export function searchHref(
  q: string,
  options: { room?: string | null; type?: string | null; page?: number } = {},
) {
  const query = new URLSearchParams({ q });
  if (options.room) query.set("room", options.room);
  // 분류(posts · comments · rooms · users). 없으면 분류별 미리보기 화면이다(HODL-100).
  if (options.type) query.set("type", options.type);
  if (options.page && options.page > 1) query.set("page", String(options.page));
  return `/search?${query.toString()}`;
}

/** 글 수정. 글쓰기처럼 헤더만 있는 화면군(`(focus)`)이다. */
export function editHref(symbol: string, postId: number): string {
  return `${postHref(symbol, postId)}/edit`;
}

/** 글쓰기. 방 안에서 누르면 그 방을 미리 고른다. */
export function writeHref(symbol?: string | null): string {
  return symbol ? `/write?symbol=${encodeURIComponent(symbol)}` : "/write";
}

/**
 * 임시저장을 이어 쓰는 화면. 새 글 임시저장은 글쓰기(`?draft=`)로, 글 수정 임시저장
 * (HODL-56)은 그 글의 수정 화면으로 간다 — 수정 화면이 들어오면서 임시저장을 먼저 찾는다.
 */
export function draftHref(draft: {
  id: number;
  coinSymbol: string;
  sourcePostId: number | null;
}): string {
  return draft.sourcePostId === null
    ? `/write?draft=${draft.id}`
    : editHref(draft.coinSymbol, draft.sourcePostId);
}

/**
 * 지금 주소가 어느 방 안인지. 방 게시판과 글 상세 둘 다 해당한다.
 * 헤더·FAB 의 글쓰기와 사이드바의 현재 방 표시가 쓴다.
 */
export function roomSymbolOf(pathname: string | null): string | null {
  const match = /^\/subhodl\/([^/]+)/.exec(pathname ?? "");
  return match ? safeSymbol(match[1]) : null;
}

/** 공개 프로필의 탭. 작성한 글이 기본이라 주소에는 `comments` 만 싣는다. */
export type ProfileTab = "posts" | "comments";

/**
 * 공개 프로필(HODL-104). 주소의 식별자는 **회원 id** 다 — 닉네임은 바뀔 수 있어
 * 화면에 보여 주는 값으로만 쓴다. 그래서 닉네임을 바꿔도 같은 주소가 같은 회원을 가리킨다.
 * 예전 `/@닉네임` 주소는 없앴고 새 주소로 넘겨 주지 않는다(404).
 *
 * `page` 는 1부터 세고 1쪽은 주소에 적지 않는다(방 게시판 · 검색과 같다).
 */
export function profileHref(
  memberId: number,
  options: { tab?: ProfileTab; page?: number } = {},
): string {
  const base = `/user/${memberId}`;
  const query = new URLSearchParams();
  if (options.tab === "comments") query.set("tab", "comments");
  if (options.page && options.page > 1) query.set("page", String(options.page));
  const search = query.toString();
  return search ? `${base}?${search}` : base;
}

/**
 * 주소의 회원 id 검사. 1 이상의 정수 숫자만 받는다(`007` · `1e3` · `-1` · `1.0` 은 아님).
 * 아니면 null — 요청을 보내지 않고 404 로 끝낸다.
 */
export function parseMemberId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * 마이페이지. 본인만 보는 화면이다. 남에게 보여 주는 공개 프로필(`profileHref`)과는
 * 다른 화면이다.
 */
export const MYPAGE_HREF = "/mypage";

/** 마이페이지 지갑 탭. 지갑 추가 · 해제와 거래소 연결 해제가 여기 있다. */
export const MYPAGE_WALLET_HREF = "/mypage/wallet";

/** 마이페이지 내 자산 탭. 지갑 · 거래소를 합산한 코인 비중 원형 차트(HODL-67). */
export const MYPAGE_ASSETS_HREF = "/mypage/assets";

/** 마이페이지 북마크 탭. 북마크한 글 전부, 북마크한 순서대로. */
export const MYPAGE_BOOKMARKS_HREF = "/mypage/bookmarks";

/** 마이페이지 임시저장 탭. 새 글과 글 수정 임시저장을 합쳐 10개까지. */
export const MYPAGE_DRAFTS_HREF = "/mypage/drafts";

/**
 * 관리자 메인. 통계 자리와 관리 메뉴가 있다. 들어올 수 있는지는 백엔드 관리자 API 의
 * 응답(403)으로 정한다 — 주소를 숨기는 것은 보안이 아니다.
 */
export const ADMIN_HREF = "/admin";

/** 관리자 방 관리 목록의 열림/닫힘 필터. 주소에는 소문자로 싣는다. */
export type AdminRoomFilter = "open" | "closed";

/**
 * 관리자 방 관리. 검색어 · 열림/닫힘 필터 · 쪽은 쿼리스트링이다(구조 규칙 8).
 * `page` 는 1부터 세고 1쪽은 주소에 적지 않는다.
 */
export function adminRoomsHref(
  options: { q?: string; status?: AdminRoomFilter | null; page?: number } = {},
): string {
  const query = new URLSearchParams();
  const q = options.q?.trim();
  if (q) query.set("q", q);
  if (options.status) query.set("status", options.status);
  if (options.page && options.page > 1) query.set("page", String(options.page));
  const search = query.toString();
  return search ? `/admin/rooms?${search}` : "/admin/rooms";
}

/** 관리자 화면에서 고른 방. 주소에 `?room=ETH` 로 싣는다. 모양이 아니면 null. */
export function adminRoomParam(value: string | undefined): string | null {
  return value ? safeSymbol(value) : null;
}

/** 관리자 방 뉴스 관리(HODL-110). 방과 쪽은 쿼리스트링이다. 쪽은 1부터, 1쪽은 적지 않는다. */
export function adminNewsHref(options: { room?: string | null; page?: number } = {}): string {
  const query = new URLSearchParams();
  if (options.room) query.set("room", options.room);
  if (options.page && options.page > 1) query.set("page", String(options.page));
  const search = query.toString();
  return search ? `/admin/news?${search}` : "/admin/news";
}

/** 관리자 방 투표 관리(HODL-111). */
export function adminPollsHref(room?: string | null): string {
  return room ? `/admin/polls?room=${encodeURIComponent(room)}` : "/admin/polls";
}

/** 관리자 배너 관리(HODL-92). */
export const ADMIN_BANNERS_HREF = "/admin/banners";

/** 방의 지난 투표 결과(HODL-109). 방 게시판 투표 칸의 "지난 결과". 쪽은 1부터, 1쪽은 적지 않는다. */
export function pollResultsHref(symbol: string, page?: number): string {
  const base = `/subhodl/${encodeURIComponent(symbol)}/polls`;
  return page && page > 1 ? `${base}?page=${page}` : base;
}

/** 마이페이지 내 투표 탭(HODL-109). 내가 고른 선택지와 그날 결과. */
export const MYPAGE_VOTES_HREF = "/mypage/votes";

export function myVotesHref(page?: number): string {
  return page && page > 1 ? `${MYPAGE_VOTES_HREF}?page=${page}` : MYPAGE_VOTES_HREF;
}

/** 뽑기 이벤트 화면(HODL-95). 배너 링크로 들어오는 것이 보통이다. */
export function drawHref(eventId: number): string {
  return `/draw/${eventId}`;
}

/** 주소의 숫자 id(뽑기 이벤트 등). 양의 정수가 아니면 null. */
export function parsePositiveId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d{0,15}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/** 주소의 `?page=`. 1부터 센다. 숫자가 아니면 1쪽. */
export function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}
