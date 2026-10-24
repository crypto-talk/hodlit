import { Extension, textblockTypeInputRule } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * 에디터에 Markdown 을 "쳐 넣거나 붙여 넣을" 때의 동작.
 *
 * 1. `# ` 를 소제목(h2)으로.
 *    본문 제목은 h2·h3 두 단계만 쓴다. 글 제목이 이미 페이지의 h1 이라 본문에
 *    h1 이 또 있으면 문서 구조가 꼬인다. 그런데 `# ` 를 치면 아무 일도 안 일어나는
 *    게 더 이상하므로 h2 로 받는다. (`## ` → h2, `### ` → h3 는 Heading 기본 동작)
 *
 * 2. Markdown 평문 붙여넣기를 서식으로.
 *    메모장·채팅·코드 에디터에서 복사한 글은 클립보드에 평문(text/plain)만 있다.
 *    Tiptap 은 그걸 글자 그대로 넣어서 `## 제목` 이 기호째 들어간다. 평문만 있고
 *    Markdown 문법이 보이면 Markdown 으로 해석해서 넣는다.
 *    웹 페이지에서 복사한 글은 HTML 이 같이 오므로 손대지 않는다 — 이미 서식이 있다.
 */
export const MarkdownInput = Extension.create({
  name: "markdownInput",

  addInputRules() {
    const heading = this.editor.schema.nodes.heading;
    if (!heading) return [];
    return [textblockTypeInputRule({ find: /^#\s$/, type: heading, getAttributes: { level: 2 } })];
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste(_view, event) {
            const clipboard = event.clipboardData;
            if (!clipboard || clipboard.getData("text/html")) return false;

            const text = clipboard.getData("text/plain");
            if (!looksLikeMarkdown(text)) return false;

            return editor.commands.insertContent(text, { contentType: "markdown" });
          },
        },
      }),
    ];
  },
});

/**
 * 평문에 Markdown 문법이 있는지. 없으면 평소처럼 글자 그대로 넣는다.
 * 기호 하나가 우연히 들어간 평범한 문장(`2*3=6`)까지 해석하지 않도록 줄 단위
 * 블록 문법이나 짝이 맞는 강조·링크만 본다.
 */
function looksLikeMarkdown(text: string): boolean {
  return (
    /^\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+[.)]\s|```)/m.test(text) ||
    /(\*\*|__|~~)\S.*?\S?\1/.test(text) ||
    /\[[^\]]+\]\([^)\s]+\)/.test(text)
  );
}
