"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { RICH_TEXT_CLASS } from "../rich-text-class";

/**
 * 글 본문(Markdown)을 그린다.
 *
 * 별도 Markdown 렌더러를 넣지 않고 에디터와 같은 Tiptap 을 읽기 전용으로 쓴다.
 *   - 쓴 화면과 읽는 화면이 같은 스키마·같은 서식(`RICH_TEXT_CLASS`)이라 어긋나지 않는다
 *   - 스키마에 없는 것은 그려지지 않는다. 본문에 HTML 을 섞어 넣어도 태그로 실행되지
 *     않으므로 따로 sanitize 할 필요가 없다
 *   - 패키지가 늘지 않는다
 * 대가: 클라이언트에서만 그려진다(`immediatelyRender: false`). 본문이 SEO 에
 * 잡히려면 나중에 서버 렌더러로 바꿔야 한다.
 */
export default function PostBody({ markdown }: { markdown: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false,
        link: { openOnClick: true, autolink: false },
      }),
      Markdown,
    ],
    content: markdown,
    contentType: "markdown",
    editorProps: {
      attributes: { class: RICH_TEXT_CLASS },
    },
  });

  return <EditorContent editor={editor} />;
}
