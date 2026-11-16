"use client";

import { useState } from "react";
import YoutubeEmbed from "./youtube-embed";
import YoutubeThumbnail from "./youtube-thumbnail";

type Props = {
  videoId: string;
};

/**
 * 누르면 재생되는 유튜브 미리보기(16:9).
 *
 * 처음에는 썸네일만 그리고, 누른 뒤에야 iframe 을 넣는다. 영상이 여러 개인 글에서
 * 유튜브 스크립트가 영상마다 먼저 따라 들어오지 않게 하고, 저절로 재생되지도 않는다.
 */
export default function YoutubePreview({ videoId }: Props) {
  const [playing, setPlaying] = useState(false);

  if (playing) return <YoutubeEmbed videoId={videoId} autoplay />;

  return (
    <button
      type="button"
      aria-label="유튜브 영상 재생"
      onClick={() => setPlaying(true)}
      className="block w-full overflow-hidden rounded-sm border border-border-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <YoutubeThumbnail videoId={videoId} className="aspect-video w-full" />
    </button>
  );
}
