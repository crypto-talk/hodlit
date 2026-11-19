"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { youtubeThumbnailSrc } from "@/lib/youtube";

type Props = {
  videoId: string;
  className?: string;
};

/**
 * 유튜브 썸네일 + 가운데 재생 표시. 영상이라는 것을 알아보게 하는 그림일 뿐이고,
 * 누르는 동작은 감싸는 쪽(버튼 · 링크)이 정한다.
 *
 * 썸네일을 못 받으면(삭제된 영상 · 네트워크) 회색 칸에 재생 표시만 남긴다.
 * 그림이 없어도 눌러서 재생해 볼 수 있어야 한다.
 */
export default function YoutubeThumbnail({ videoId, className }: Props) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={cn("relative block overflow-hidden bg-canvas", className)}>
      {failed ? null : (
        // eslint-disable-next-line @next/next/no-img-element -- 외부 썸네일, 최적화 대상 아님
        <img
          src={youtubeThumbnailSrc(videoId)}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 inline-flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white [&_svg]:size-5 [&_svg]:translate-x-px [&_svg]:fill-current"
      >
        <Play />
      </span>
    </span>
  );
}
