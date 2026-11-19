"use client";

import { useState } from "react";
import Link from "next/link";
import YoutubeEmbed from "@/components/media/youtube-embed";
import YoutubeThumbnail from "@/components/media/youtube-thumbnail";
import type { PostImage } from "@/lib/post-summary";

type Props = {
  images: PostImage[];
  videoId: string | null;
  /** 글 상세 주소. 사진을 누르면 여기로 간다. */
  href: string;
};

/** 목록 카드에 칸으로 보이는 첨부 수. 넘치면 마지막 칸에 "+N" 을 얹는다. */
const TILE_MAX = 4;

type Item = { kind: "video"; id: string } | { kind: "image"; id: string; src: string };

/**
 * 글 목록 카드의 첨부 사진 · 영상 미리보기(HODL-127).
 *
 * - 순서는 영상 → 사진(서버 순서). 사진이 많아도 영상이 칸 밖으로 밀려나지 않게 영상을 앞에 둔다
 * - 하나뿐이면 크게: 사진은 원본 비율 그대로(높이만 제한), 영상은 16:9
 * - 둘 이상이면 같은 크기의 정사각 칸 4개까지. 넘치는 수는 마지막 칸에 "+N" — 누르면 글 상세로
 * - 사진을 누르면 글 상세로 간다. 영상을 누르면 카드 안에서 재생한다(누르기 전에는 썸네일만,
 *   저절로 재생하지 않는다). 둘 다 링크 · 버튼이라 키보드로 고를 수 있다
 * - 못 불러온 사진은 그 칸만 뺀다. 다 빠지면 아무것도 그리지 않고 글은 그대로다
 */
export default function PostMedia({ images, videoId, href }: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);

  const items: Item[] = [
    ...(videoId ? [{ kind: "video" as const, id: videoId }] : []),
    ...images
      .filter((image) => !failed.includes(image.id))
      .map((image) => ({ kind: "image" as const, ...image })),
  ];
  if (items.length === 0) return null;

  const fail = (id: string) => setFailed((current) => [...current, id]);
  const player =
    playing && videoId ? (
      <div className="mt-3">
        <YoutubeEmbed videoId={videoId} autoplay />
        <button
          type="button"
          className="mt-1 text-xs text-text-muted hover:text-text-primary"
          onClick={() => setPlaying(false)}
        >
          영상 닫기
        </button>
      </div>
    ) : null;

  if (items.length === 1) {
    const [only] = items;
    if (only.kind === "video") {
      return (
        player ?? (
          <button
            type="button"
            aria-label="첨부 유튜브 영상 재생"
            onClick={() => setPlaying(true)}
            className={`${FOCUS} mt-3 block w-full max-w-md overflow-hidden rounded-sm border border-border-subtle`}
          >
            <YoutubeThumbnail videoId={only.id} className="aspect-video w-full" />
          </button>
        )
      );
    }
    return (
      <Link
        href={href}
        aria-label="첨부 사진 — 글에서 보기"
        className={`${FOCUS} mt-3 inline-block max-w-full overflow-hidden rounded-sm border border-border-subtle bg-canvas`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버의 원본. next/image 원격 설정 전 */}
        <img
          src={only.src}
          alt=""
          loading="lazy"
          className="block max-h-80 w-auto max-w-full object-contain"
          onError={() => fail(only.id)}
        />
      </Link>
    );
  }

  const shown = items.slice(0, TILE_MAX);
  const extra = items.length - shown.length;

  return (
    <div>
      {player}
      <ul aria-label="첨부 사진 · 영상" className="mt-3 grid grid-cols-4 gap-2">
        {shown.map((item, index) => {
          const more = extra > 0 && index === shown.length - 1;
          return (
            <li key={`${item.kind}-${item.id}`} className="relative aspect-square">
              {item.kind === "video" ? (
                <button
                  type="button"
                  aria-label="첨부 유튜브 영상 재생"
                  aria-pressed={playing}
                  onClick={() => setPlaying(true)}
                  className={`${FOCUS} ${TILE}`}
                >
                  <YoutubeThumbnail videoId={item.id} className="size-full" />
                </button>
              ) : (
                <Link
                  href={href}
                  aria-label={more ? `첨부 ${extra}개 더 — 글에서 보기` : `첨부 사진 — 글에서 보기`}
                  className={`${FOCUS} ${TILE} bg-canvas`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버의 원본. next/image 원격 설정 전 */}
                  <img
                    src={item.src}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                    onError={() => fail(item.id)}
                  />
                  {more ? (
                    <span
                      aria-hidden
                      className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white"
                    >
                      +{extra}
                    </span>
                  ) : null}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const TILE = "relative block size-full overflow-hidden rounded-sm border border-border-subtle";
