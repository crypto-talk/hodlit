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

/** 방 게시판. 탭은 쿼리스트링이다(구조 규칙 8). */
export function roomHref(symbol: string, tab?: "verified"): string {
  const base = `/subhodl/${encodeURIComponent(symbol)}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/** 글 상세. */
export function postHref(symbol: string, postId: number): string {
  return `/subhodl/${encodeURIComponent(symbol)}/${postId}`;
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
 * 지금 주소가 어느 방 안인지. 방 게시판과 글 상세 둘 다 해당한다.
 * 헤더·FAB 의 글쓰기와 사이드바의 현재 방 표시가 쓴다.
 */
export function roomSymbolOf(pathname: string | null): string | null {
  const match = /^\/subhodl\/([^/]+)/.exec(pathname ?? "");
  return match ? safeSymbol(match[1]) : null;
}
