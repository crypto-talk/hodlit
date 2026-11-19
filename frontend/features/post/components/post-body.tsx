import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { BODY_EXTENSIONS, bodyMarkdown } from "../body-markdown";
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
 * 스키마와 링크 처리는 `../body-markdown.ts` 에 있다. 본문 속 유튜브 링크의 미리보기는
 * 글 상세(`post-detail.tsx`)가 본문 아래에 붙인다.
 */
export default function PostBody({ markdown: source }: { markdown: string }) {
  return (
    <div className={RICH_TEXT_CLASS}>
      {renderToReactElement({ extensions: BODY_EXTENSIONS, content: bodyMarkdown.parse(source) })}
    </div>
  );
}
