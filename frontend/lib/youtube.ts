/**
 * 유튜브 주소 · 영상 id 를 다루는 곳.
 *
 * 글쓰기의 유튜브 칸(첨부 영상), 본문 속 유튜브 링크 미리보기(HODL-123),
 * 글 목록 카드의 영상 미리보기(HODL-127)가 같이 쓴다. features 끼리 참조할 수 없어서
 * `lib/` 에 있다(구조 규칙 1).
 */

/**
 * 백엔드 `PostService.YOUTUBE` 와 같은 패턴. 영상 id(11자)를 꺼낸다.
 * 일반 영상(`youtube.com/watch?v=`) · 단축(`youtu.be/`) · Shorts(`youtube.com/shorts/`).
 * 서버가 다시 검사하지만, 화면에서 먼저 걸러야 미리보기를 보여줄 수 있다.
 */
const YOUTUBE_PATTERN =
  /^(?:https:\/\/)?(?:www\.)?(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&].*)?$/;

/**
 * 글 사이에 섞인 주소를 찾는 패턴. 위와 같은 주소 모양이되, 앞뒤에 다른 글자가 붙어 있어도
 * 찾는다(`영상: youtu.be/…).` 처럼). 영상 id 바로 뒤에 id 글자가 더 붙으면 다른 주소라 뺀다.
 */
const YOUTUBE_IN_TEXT =
  /(?:^|[^A-Za-z0-9_.\-/])(?:https:\/\/)?(?:www\.)?(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/g;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Tiptap 문서(JSON)에서 여기서 읽는 부분만. `editor.getJSON()` 과 `MarkdownManager.parse()` 의
 * 결과(`JSONContent`)가 그대로 들어온다.
 */
export type DocNode = {
  type?: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
};

/** 주소 하나가 유튜브 영상 주소면 영상 id, 아니면 null. */
export function youtubeVideoId(url: string): string | null {
  return YOUTUBE_PATTERN.exec(url.trim())?.[1] ?? null;
}

/**
 * 서버가 준 영상 id 를 주소에 넣어도 되는지. 11자 영상 id 모양만 받는다.
 * 주소 조각(`/` · `?`)이 섞인 값이 이미지 · iframe 주소로 들어가지 않게 한다.
 */
export function isYoutubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && VIDEO_ID.test(value);
}

/** 썸네일. 서버도 같은 주소(`i.ytimg.com/vi/<id>/hqdefault.jpg`)를 저장한다. */
export function youtubeThumbnailSrc(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * 재생 칸 주소. 쿠키를 덜 남기는 youtube-nocookie 다.
 * `autoplay` 는 사람이 썸네일을 눌러 연 경우에만 켠다 — 목록 · 상세에서 저절로 재생하지 않는다.
 */
export function youtubeEmbedSrc(videoId: string, autoplay = false): string {
  const base = `https://www.youtube-nocookie.com/embed/${videoId}`;
  return autoplay ? `${base}?autoplay=1` : base;
}

/**
 * 본문(Tiptap 문서)에 들어 있는 유튜브 영상 id. 처음 나온 순서대로, 겹치지 않게.
 *
 * - 링크(`link` 표시)의 주소가 유튜브 영상 주소면 넣는다
 * - 링크가 아닌 글자 속 주소도 넣는다(자동 링크가 안 걸린 예전 글 · 붙여 넣은 평문)
 * - 코드(`code` 표시 · 코드 블록) 안의 주소는 넣지 않는다. 보여 주려고 적은 주소다
 *
 * 유튜브 영상으로 인식되지 않는 주소는 아무것도 하지 않는다 — 원래 링크 그대로다.
 */
export function youtubeIdsInContent(doc: DocNode | null | undefined): string[] {
  const found: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !found.includes(id)) found.push(id);
  };

  const visit = (node: DocNode) => {
    if (node.type === "codeBlock") return;
    if (node.type === "text") {
      const marks = node.marks ?? [];
      if (marks.some((mark) => mark.type === "code")) return;
      for (const mark of marks) {
        const href = mark.type === "link" ? mark.attrs?.href : null;
        if (typeof href === "string") add(youtubeVideoId(href));
      }
      for (const match of (node.text ?? "").matchAll(YOUTUBE_IN_TEXT)) add(match[1]);
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };

  if (doc) visit(doc);
  return found;
}
