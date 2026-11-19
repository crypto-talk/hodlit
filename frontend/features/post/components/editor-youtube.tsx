"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { youtubeIdsInContent, youtubeThumbnailSrc } from "@/lib/youtube";

type Props = {
  editor: Editor;
};

/**
 * 글쓰기 · 수정 — 본문에 붙여 넣은 유튜브 링크의 미리보기(HODL-123).
 *
 * 본문을 고칠 때마다 본문 안의 유튜브 영상 주소를 다시 찾는다. 그래서 링크를 지우면
 * 미리보기도 같이 사라진다. 일반 영상 · youtu.be 단축 · Shorts 주소를 알아보고,
 * 그 밖의 주소는 원래 링크 그대로 둔다.
 *
 * 쓰는 동안에는 썸네일만 띄운다(유튜브 칸과 같은 이유 — iframe 이면 유튜브 스크립트가
 * 통째로 따라 들어온다). 읽는 화면에서는 눌러서 재생할 수 있다.
 */
export default function EditorYoutube({ editor }: Props) {
  const videoIds = useEditorState({
    editor,
    selector: ({ editor: current }) => youtubeIdsInContent(current.getJSON()),
    equalityFn: (a, b) => !!b && a.length === b.length && a.every((id, index) => id === b[index]),
  });

  if (videoIds.length === 0) return null;

  return (
    <ul
      aria-label="본문의 유튜브 영상"
      className="flex flex-col gap-2 border-t border-border-subtle p-2"
    >
      {videoIds.map((id) => (
        <li
          key={id}
          className="flex items-center gap-3 rounded-sm border border-border-subtle bg-surface p-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 외부 썸네일, 최적화 대상 아님 */}
          <img
            src={youtubeThumbnailSrc(id)}
            alt="유튜브 썸네일"
            className="h-16 w-28 flex-none rounded-sm object-cover"
          />
          <p className="min-w-0 text-xs text-text-muted">
            본문의 유튜브 영상 · 글에서 영상 미리보기로 보입니다
          </p>
        </li>
      ))}
    </ul>
  );
}
