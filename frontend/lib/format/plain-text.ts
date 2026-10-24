/**
 * Markdown 본문 → 목록 미리보기용 평문.
 *
 * 글 본문은 Markdown 문자열로 저장된다(E-2). 상세 화면은 이걸 서식으로 그리지만,
 * 목록 미리보기는 원문을 잘라 보여주므로 그대로 두면 `### 제목` `**굵게**` 같은
 * 기호가 보인다. 기호만 걷어내고 글자는 남긴다.
 *
 * 완전한 Markdown 파서가 아니다. 에디터(Tiptap StarterKit)가 만들어 내는 문법만
 * 다룬다 — 제목, 굵게·기울임·취소선, 인라인 코드·코드 블록, 링크, 인용, 목록,
 * 구분선, 이스케이프. 평문으로 쓴 예전 글은 바뀌지 않고 그대로 나온다.
 */
export function markdownToPlainText(markdown: string): string {
  const lines: string[] = [];

  for (const raw of markdown.split(/\r?\n/)) {
    let line = raw;
    // 코드 블록 울타리와 구분선은 글자가 아니다.
    if (/^\s*(```|~~~)/.test(line)) continue;
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) continue;

    line = line
      .replace(/^\s*(>\s?)+/, "") // 인용
      .replace(/^\s*#{1,6}\s+/, "") // 제목
      .replace(/^\s*([-*+]|\d+[.)])\s+/, ""); // 목록

    lines.push(stripInline(line));
  }

  return lines.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * 이스케이프된 기호(`\*`)는 걷어내기 전에 사용자 영역 문자로 숨겼다가 끝나고
 * 되돌린다. 먼저 숨기지 않으면 `\*주의\*` 가 기울임으로 읽혀 기호가 사라진다.
 */
const HIDE_BASE = 0xe000;

function stripInline(text: string): string {
  const hidden = text.replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, (_, symbol: string) =>
    String.fromCharCode(HIDE_BASE + symbol.charCodeAt(0)),
  );

  return hidden
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "") // 이미지: 미리보기에서는 뺀다
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 링크: 글자만
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1") // 자동 링크
    .replace(/`([^`]+)`/g, "$1") // 인라인 코드
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // 굵게
    .replace(/~~(.+?)~~/g, "$1") // 취소선
    .replace(/(^|[^\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, "$1$2") // 기울임 *
    .replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1$2") // 기울임 _ (snake_case 는 둔다)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[\ue000-\ue07f]/g, (char) => String.fromCharCode(char.charCodeAt(0) - HIDE_BASE));
}
