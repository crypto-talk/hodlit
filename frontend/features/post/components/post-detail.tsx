"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { coinNameKo } from "@/lib/coin-name-ko";
import { formatKrw } from "@/lib/format/number";
import { formatRelativeTime } from "@/lib/format/time";
import { ApiError } from "@/lib/http";
import { loadPost } from "../api";
import PostBody from "./post-body";

type Props = {
  postId: number;
  symbol: string;
};

/**
 * 글 상세 1단계 — 제목 · 작성자 · 본문 · 이미지 · 유튜브 · 작성 시점 가격.
 *
 * 아직 없는 것
 *   - 보유 스냅샷 블록(배지·수량 구간·보유 기간) — `types.ts` 의 PostDetail 주석 참고
 *   - 댓글 · 좋아요 · 북마크 · 재게시 버튼
 *   - 수정 · 삭제
 */
export default function PostDetailView({ postId, symbol }: Props) {
  const post = useQuery({ queryKey: ["post", postId], queryFn: () => loadPost(postId) });

  if (post.isPending) {
    return <p className="text-sm text-text-muted">불러오는 중…</p>;
  }

  if (post.isError) {
    const missing = post.error instanceof ApiError && post.error.status === 404;
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
        <p className="text-body font-semibold">
          {missing ? "글을 찾을 수 없습니다." : "글을 불러오지 못했습니다."}
        </p>
        {missing ? null : (
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-brand"
            onClick={() => post.refetch()}
          >
            다시 시도
          </button>
        )}
      </div>
    );
  }

  const data = post.data;
  const room = data.coinSymbol || symbol;

  return (
    <article className="rounded-lg border border-border-subtle bg-surface p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
        <Link
          href={`/subhodl/${encodeURIComponent(room)}`}
          className="rounded-sm border border-border-subtle bg-canvas px-2 py-0.5 text-xs font-semibold"
        >
          {room} · {coinNameKo(room, room)}
        </Link>
        <span className="flex-1" />
        <time dateTime={data.createdAt}>{formatRelativeTime(data.createdAt)}</time>
        {data.edited ? <span>· 수정됨</span> : null}
      </div>

      <h1 className="mt-4 text-h1 font-semibold break-words text-text-primary">{data.title}</h1>
      <p className="mt-2 text-sm font-semibold text-text-primary">{data.authorNickname}</p>

      <div className="mt-6">
        <PostBody markdown={data.content} />
      </div>

      {data.images.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3">
          {data.images.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버의 원본. next/image 원격 설정 전
            <img
              key={image.id}
              src={image.src}
              alt=""
              loading="lazy"
              className="max-h-[640px] w-full rounded-sm border border-border-subtle bg-canvas object-contain"
            />
          ))}
        </div>
      ) : null}

      {data.youtubeVideoId ? (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-sm border border-border-subtle">
          {/* 쿠키를 덜 남기는 youtube-nocookie 임베드 */}
          <iframe
            className="size-full"
            src={`https://www.youtube-nocookie.com/embed/${data.youtubeVideoId}`}
            title="유튜브 영상"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border-subtle pt-4 text-sm text-text-muted">
        {data.price ? (
          <span>
            작성 시점 {room}{" "}
            <b className="font-semibold text-text-primary tabular-nums">
              {data.price.currency === "KRW"
                ? formatKrw(data.price.value)
                : `${data.price.value} ${data.price.currency}`}
            </b>
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="tabular-nums">
          좋아요 {data.likes} · 댓글 {data.comments}
        </span>
      </div>
    </article>
  );
}
