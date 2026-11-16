"use client";

import { useMemo } from "react";
import YoutubePreview from "@/components/media/youtube-preview";
import { bodyYoutubeIds } from "../body-markdown";

type Props = {
  /** 글 본문(Markdown). */
  content: string;
  /** 유튜브 칸으로 붙인 영상 id. 본문 아래에 이미 재생 칸이 있으니 여기서는 뺀다. */
  attached: string | null;
};

/**
 * 글 상세 — 본문에 들어 있는 유튜브 링크의 영상 미리보기(HODL-123).
 *
 * 본문 속 링크는 그대로 링크로 두고, 본문 바로 아래에 영상마다 미리보기를 붙인다.
 * 누르기 전에는 썸네일만 있어 저절로 재생되지 않는다. 유튜브 영상이 아닌 주소는
 * 아무것도 붙지 않는다(원래 링크 그대로).
 */
export default function BodyYoutube({ content, attached }: Props) {
  const videoIds = useMemo(
    () => bodyYoutubeIds(content).filter((id) => id !== attached),
    [content, attached],
  );

  if (videoIds.length === 0) return null;

  return (
    <ul aria-label="본문의 유튜브 영상" className="mt-6 flex flex-col gap-3">
      {videoIds.map((id) => (
        <li key={id}>
          <YoutubePreview videoId={id} />
        </li>
      ))}
    </ul>
  );
}
