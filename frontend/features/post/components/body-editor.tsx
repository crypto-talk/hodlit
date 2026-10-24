"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownInput } from "../markdown-input";
import { RICH_TEXT_CLASS } from "../rich-text-class";

type Props = {
  /** 바뀔 때마다 Markdown 문자열로 올려 보낸다. 백엔드 `content` 에 그대로 실린다. */
  onChange: (markdown: string) => void;
  disabled: boolean;
  /** 처음 채울 Markdown. 수정 화면이 쓴다. 마운트 때 한 번만 읽는다. */
  initialContent?: string;
};

/**
 * 본문 에디터 (Tiptap, E-2).
 *
 * 저장 형식은 Markdown 이다. Tiptap JSON 이 아니라 Markdown 을 고른 이유
 *   - 백엔드 `content` 는 5000자 문자열이다. JSON 은 서식 정보로 몇 배 길어진다
 *   - 평문으로 쓴 예전 글이 그대로 유효한 Markdown 이라 따로 처리할 게 없다
 *   - 목록 미리보기는 `lib/format/plain-text.ts` 로 기호만 걷어내면 된다
 * 대가: 차트처럼 Markdown 에 없는 블록은 표기를 따로 정해야 한다. 차트는 가격
 * 데이터를 어디 저장할지 백엔드와 정한 뒤에 붙인다.
 *
 * 밑줄은 끈다. Markdown 에 밑줄 문법이 없어 저장하면 사라진다.
 * 이미지는 아직 본문 안이 아니라 아래 첨부 칸으로 붙는다. 백엔드 `media` 목록과
 * 본문 안 위치를 어떻게 맞출지 정한 뒤에 옮긴다.
 */
export default function BodyEditor({ onChange, disabled, initialContent }: Props) {
  const editor = useEditor({
    content: initialContent ?? "",
    contentType: "markdown",
    // App Router 에서 서버 렌더와 첫 클라이언트 렌더가 어긋나지 않게 한다.
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
        },
      }),
      Markdown,
      MarkdownInput,
      Placeholder.configure({ placeholder: "본문" }),
    ],
    editorProps: {
      attributes: {
        "aria-label": "본문",
        class: cn(
          RICH_TEXT_CLASS,
          "min-h-105 px-3 py-3 outline-none",
          // 빈 에디터의 자리 표시 문구 (Placeholder 확장이 data-placeholder 를 단다)
          "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-text-subtle [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        ),
      },
    },
    onUpdate: ({ editor: current }) => {
      // 빈 문단만 남으면 빈 문자열로 본다. 백엔드 @NotBlank 와 같은 기준.
      onChange(current.isEmpty ? "" : current.getMarkdown());
    },
  });

  // 발행 중에는 고치지 못하게 잠근다. useEditor 의 editable 은 처음 한 번만 읽힌다.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div className="mt-2 rounded-sm border border-border-subtle bg-canvas focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-brand">
      {editor ? <Toolbar editor={editor} disabled={disabled} /> : <ToolbarPlaceholder />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const [linkOpen, setLinkOpen] = useState(false);

  // 커서가 움직일 때마다 버튼의 눌림 상태를 다시 읽는다.
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      heading: current.isActive("heading", { level: 2 }),
      quote: current.isActive("blockquote"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      link: current.isActive("link"),
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div className="border-b border-border-subtle">
      <div role="toolbar" aria-label="서식" className="flex flex-wrap items-center gap-1 p-1.5">
        <ToolButton
          label="굵게"
          on={active.bold}
          disabled={disabled}
          onClick={() => chain().toggleBold().run()}
        >
          <Bold />
        </ToolButton>
        <ToolButton
          label="기울임"
          on={active.italic}
          disabled={disabled}
          onClick={() => chain().toggleItalic().run()}
        >
          <Italic />
        </ToolButton>
        <ToolButton
          label="취소선"
          on={active.strike}
          disabled={disabled}
          onClick={() => chain().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolButton>
        <ToolButton
          label="코드"
          on={active.code}
          disabled={disabled}
          onClick={() => chain().toggleCode().run()}
        >
          <Code />
        </ToolButton>
        <Divider />
        <ToolButton
          label="소제목"
          on={active.heading}
          disabled={disabled}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </ToolButton>
        <ToolButton
          label="인용"
          on={active.quote}
          disabled={disabled}
          onClick={() => chain().toggleBlockquote().run()}
        >
          <Quote />
        </ToolButton>
        <ToolButton
          label="글머리 목록"
          on={active.bullet}
          disabled={disabled}
          onClick={() => chain().toggleBulletList().run()}
        >
          <List />
        </ToolButton>
        <ToolButton
          label="번호 목록"
          on={active.ordered}
          disabled={disabled}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolButton>
        <Divider />
        <ToolButton
          label="링크"
          on={active.link || linkOpen}
          disabled={disabled}
          onClick={() => setLinkOpen((open) => !open)}
        >
          <Link2 />
        </ToolButton>
      </div>
      {linkOpen ? (
        <LinkInput
          initial={(editor.getAttributes("link").href as string | undefined) ?? ""}
          onApply={(href) => {
            if (href) {
              chain().extendMarkRange("link").setLink({ href }).run();
            } else {
              chain().extendMarkRange("link").unsetLink().run();
            }
            setLinkOpen(false);
          }}
          onCancel={() => setLinkOpen(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * 링크 주소 입력. `window.prompt` 는 쓰지 않는다 — 화면을 막는 브라우저 대화상자다.
 * 비우고 적용하면 링크를 푼다. 위험한 주소(`javascript:` 등)는 Tiptap Link 가 거른다.
 */
function LinkInput({
  initial,
  onApply,
  onCancel,
}: {
  initial: string;
  onApply: (href: string) => void;
  onCancel: () => void;
}) {
  const [href, setHref] = useState(initial);

  // 바깥 글쓰기 <form> 안에 있으므로 <form> 을 겹치지 않고 Enter 를 직접 잡는다.
  const apply = (event?: FormEvent) => {
    event?.preventDefault();
    onApply(href.trim());
  };

  return (
    <div className="flex items-center gap-2 border-t border-border-subtle px-2 py-1.5">
      <input
        autoFocus
        className="h-8 min-w-0 flex-1 rounded-sm border border-border-subtle bg-surface px-2 text-sm text-text-primary focus:-outline-offset-1 focus:outline-2 focus:outline-brand"
        aria-label="링크 주소"
        placeholder="https://… (비우면 링크 해제)"
        value={href}
        onChange={(event) => setHref(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply(event);
          if (event.key === "Escape") onCancel();
        }}
      />
      <button type="button" className="text-sm font-semibold text-brand" onClick={() => apply()}>
        적용
      </button>
      <button type="button" className="text-sm text-text-muted" onClick={onCancel}>
        취소
      </button>
    </div>
  );
}

function ToolButton({
  label,
  on,
  disabled,
  onClick,
  children,
}: {
  label: string;
  on: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      // 버튼을 눌러도 에디터의 선택 영역이 풀리지 않게 한다.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm text-text-muted hover:bg-surface hover:text-text-primary disabled:opacity-60 [&_svg]:size-4",
        on && "bg-brand-soft text-text-primary hover:bg-brand-soft",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border-subtle" />;
}

/** 에디터가 마운트되기 전 자리. 높이를 맞춰 화면이 튀지 않게 한다. */
function ToolbarPlaceholder() {
  return <div className="h-11 border-b border-border-subtle" />;
}
