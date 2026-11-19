import { cn } from "@/lib/utils";
import { youtubeEmbedSrc } from "@/lib/youtube";

type Props = {
  videoId: string;
  /** 사람이 썸네일을 눌러 연 경우에만 켠다. 저절로 재생하지 않는다. */
  autoplay?: boolean;
  className?: string;
};

/**
 * 유튜브 재생 칸(16:9). 쿠키를 덜 남기는 youtube-nocookie 임베드다.
 * `videoId` 는 부르는 쪽이 `lib/youtube.ts` 로 걸러서 넘긴다.
 */
export default function YoutubeEmbed({ videoId, autoplay = false, className }: Props) {
  return (
    <div
      className={cn(
        "aspect-video w-full overflow-hidden rounded-sm border border-border-subtle bg-canvas",
        className,
      )}
    >
      <iframe
        className="size-full"
        src={youtubeEmbedSrc(videoId, autoplay)}
        title="유튜브 영상"
        loading="lazy"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
