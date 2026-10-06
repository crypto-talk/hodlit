/**
 * 화면 주소를 만드는 곳.
 *
 * 글 주소는 랜딩·방 게시판·글쓰기(발행 후 이동)가 모두 쓴다. 각자 문자열을
 * 조립하면 한쪽만 바뀌는 일이 생겨서 여기 둔다. features 끼리는 참조할 수
 * 없으므로(구조 규칙 1) lib 에 있다.
 */
export function postHref(symbol: string, postId: number): string {
  return `/subhodl/${encodeURIComponent(symbol)}/${postId}`;
}
