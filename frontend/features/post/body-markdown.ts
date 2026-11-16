import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { youtubeIdsInContent } from "@/lib/youtube";

/**
 * 글을 읽는 쪽(글 상세)이 쓰는 본문 스키마. 에디터(`components/body-editor.tsx`)와 같은
 * StarterKit 설정이라 쓴 화면과 읽는 화면이 어긋나지 않는다.
 *
 * 링크는 StarterKit 기본값대로 새 탭 + `noopener noreferrer nofollow` 로 나간다.
 * 회원이 쓴 링크라 검색엔진에 추천 신호를 주지 않는다(`nofollow`).
 */
export const BODY_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    underline: false,
    link: { openOnClick: true, autolink: false },
  }),
];

export const bodyMarkdown = new MarkdownManager({ extensions: BODY_EXTENSIONS });

/**
 * 본문(Markdown)에 들어 있는 유튜브 영상 id(HODL-123). 처음 나온 순서대로, 겹치지 않게.
 * 규칙은 `lib/youtube.ts` 의 `youtubeIdsInContent()` 다 — 에디터 미리보기와 같은 함수.
 */
export function bodyYoutubeIds(source: string): string[] {
  if (!source.trim()) return [];
  return youtubeIdsInContent(bodyMarkdown.parse(source));
}
