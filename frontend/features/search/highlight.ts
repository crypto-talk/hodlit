/**
 * 글자에서 검색어와 같은 부분을 표시하려고 조각낸다. 대소문자는 무시한다(서버와 같은 기준).
 *
 * HTML 을 만들지 않고 조각만 돌려준다 — 화면이 `<mark>` 로 감싸고 React 가 이스케이프한다.
 * 소문자로 바꾸면 길이가 달라지는 글자(예: `İ`)가 섞이면 위치가 어긋나므로 표시하지 않는다.
 */
export function highlightParts(text: string, q: string): { text: string; match: boolean }[] {
  const needle = q.trim().toLowerCase();
  const lower = text.toLowerCase();
  if (!needle || lower.length !== text.length) return [{ text, match: false }];

  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length ? parts : [{ text, match: false }];
}
