import { MarkdownManager } from "@tiptap/markdown";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import StarterKit from "@tiptap/starter-kit";
import { RICH_TEXT_CLASS } from "../rich-text-class";

/**
 * 글 본문(Markdown)을 그린다.
 *
 * 에디터와 같은 Tiptap 스키마로 읽되, 에디터를 띄우지 않고 정적 렌더러로 그린다.
 *   - 쓴 화면과 읽는 화면이 같은 스키마·같은 서식(`RICH_TEXT_CLASS`)이라 어긋나지 않는다
 *   - 스키마에 없는 것은 그려지지 않는다. 본문에 HTML 을 섞어 넣어도 태그로 실행되지
 *     않으므로 따로 sanitize 할 필요가 없다
 *   - 서버에서도 그려진다. 본문이 첫 HTML 에 들어가 검색엔진 · AI 크롤러가 읽을 수 있다
 *
 * 링크는 StarterKit 기본값대로 새 탭 + `noopener noreferrer nofollow` 로 나간다.
 * 회원이 쓴 링크라 검색엔진에 추천 신호를 주지 않는다(`nofollow`).
 */
const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    underline: false,
    link: { openOnClick: true, autolink: false },
  }),
];

const markdown = new MarkdownManager({ extensions });

export default function PostBody({ markdown: source }: { markdown: string }) {
  return (
    <div className={RICH_TEXT_CLASS}>
      {renderToReactElement({ extensions, content: markdown.parse(source) })}
    </div>
  );
}
