"use client";

import Link from "next/link";
import TierBadge from "@/components/holder/tier-badge";
import { UNSUPPORTED_LABEL, isHolderTier } from "@/lib/holder-snapshot/label";
import { coinNameKo } from "@/lib/coin-name-ko";
import { formatKrw } from "@/lib/format/number";
import { formatRelativeTime } from "@/lib/format/time";
import { ApiError } from "@/lib/http";
import { roomHref } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { usePost } from "../hooks/use-post";
import PostActions from "./post-actions";
import PostBody from "./post-body";
import PostOwnerActions from "./post-owner-actions";

type Props = {
  postId: number;
  symbol: string;
};

/**
 * 글 상세 1단계 — 제목 · 작성자 · 본문 · 이미지 · 유튜브 · 작성 시점 가격.
 *
 * 보유 스냅샷 블록이 이 서비스의 "포인트 하나"다. 발행 순간 기록되고 이후
 * 바뀌지 않는다는 것을 블록 안에서 말한다.
 *
 * 댓글은 `features/comment` 이고, 상세 페이지(`app/…/post-view.tsx`)가 이 아래에 붙인다.
 *
 * 맨 아래 줄에 작성 시점 가격과 좋아요 · 북마크(`post-actions.tsx`)가 있다.
 *
 * 글쓴이에게는 제목 위 줄에 수정 · 삭제(`post-owner-actions.tsx`)가 붙는다.
 *
 * 아직 없는 것: 재게시 (이번 범위에서 뺐다)
 */
export default function PostDetailView({ postId, symbol }: Props) {
  const post = usePost(postId);
  const { member } = useSession();

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
          href={roomHref(room)}
          className="rounded-sm border border-border-subtle bg-canvas px-2 py-0.5 text-xs font-semibold"
        >
          {room} · {coinNameKo(room, room)}
        </Link>
        <span className="flex-1" />
        <time dateTime={data.createdAt}>{formatRelativeTime(data.createdAt)}</time>
        {data.edited ? <span>· 수정됨</span> : null}
        {member && data.authorId === member.id ? (
          <PostOwnerActions postId={data.id} room={room} />
        ) : null}
      </div>

      <h1 className="mt-4 text-h1 font-semibold break-words text-text-primary">{data.title}</h1>
      <p className="mt-2 text-sm font-semibold text-text-primary">{data.authorNickname}</p>

      {data.holder && !data.holder.verifiable ? (
        <p className="mt-4 rounded-sm border border-border-subtle bg-canvas p-4 text-sm text-text-muted">
          <b className="font-semibold text-text-primary">{UNSUPPORTED_LABEL}</b> · {room} 방은 아직
          보유 인증을 지원하지 않아 이 글에는 보유 정보가 붙지 않습니다.
        </p>
      ) : null}

      {data.holder?.verifiable ? (
        <section
          aria-label="작성 시점 보유 정보"
          className="mt-4 rounded-sm border border-border-subtle bg-canvas p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <TierBadge tier={data.holder.tier} symbol={room} />
            {isHolderTier(data.holder.tier) ? (
              <span className="text-sm font-semibold text-text-primary">{data.holder.holding}</span>
            ) : null}
            {data.holder.tier === "empty" ? (
              <span className="text-sm text-text-muted">
                작성 시점에 연결한 지갑의 {room} 잔액이 0이었습니다.
              </span>
            ) : null}
            {data.holder.amount ? (
              <span className="rounded-sm border border-border-subtle px-2 py-0.5 text-xs text-text-muted tabular-nums">
                {data.holder.amount}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            작성 시점에 기록된 보유 정보입니다. 이후 글을 수정해도 바뀌지 않습니다.
          </p>
        </section>
      ) : null}

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
        <PostActions
          postId={data.id}
          reactions={{ likes: data.likes, liked: data.liked, bookmarked: data.bookmarked }}
          comments={data.comments}
        />
      </div>
    </article>
  );
}
