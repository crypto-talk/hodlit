import Link from "next/link";
import TierBadge from "@/components/holder/tier-badge";
import type { PostSummary } from "@/lib/post-summary";
import { roomHref } from "@/lib/routes";

type Props = {
  post: PostSummary;
  /**
   * 방 칩을 그릴지. 랜딩처럼 여러 방의 글이 섞이는 목록에서만 켠다.
   * 방 게시판 안에서는 전부 같은 방이라 끈다.
   */
  showRoom?: boolean;
};

// 조회수 API가 없습니다. 값이 없으면 숫자를 지어내지 않고 자리를 뺍니다(G-5).
const stats = (post: PostSummary) =>
  post.views === null
    ? `댓글 ${post.comments}`
    : `댓글 ${post.comments} · 조회 ${post.views.toLocaleString("en-US")}`;

/**
 * 글 목록 카드. 랜딩 전체 글과 방 게시판이 같이 쓴다.
 *
 * 랜딩 `post-feed.tsx` 안에 있던 마크업을 그대로 옮겼다. 데이터는
 * `lib/post-summary.ts` 의 `toPostSummary()` 가 만든다.
 */
export default function PostCard({ post, showRoom = true }: Props) {
  return (
    <article className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        {showRoom ? (
          <Link
            href={roomHref(post.symbol)}
            className="flex-none rounded-sm border border-border-subtle bg-canvas px-2 py-0.5 text-xs font-semibold text-text-muted hover:border-text-muted hover:text-text-primary"
          >
            {post.symbol}
          </Link>
        ) : null}
        {post.verifiable ? <TierBadge tier={post.tier} symbol={post.symbol} /> : null}
        {post.range ? (
          <span className="flex-none rounded-sm border border-border-subtle px-2 py-0.5 text-xs text-text-muted tabular-nums">
            {post.range}
          </span>
        ) : null}
        <span className="flex-1" />
        <time dateTime={post.createdAt} className="text-xs text-text-muted">
          {post.time}
        </time>
      </div>

      <Link
        href={post.href}
        className="mt-4 block text-h2 font-semibold break-words text-text-primary hover:text-brand"
      >
        {post.title}
      </Link>
      {post.preview ? <p className="mt-2 text-body text-text-muted">{post.preview}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border-subtle pt-4">
        {/* 공개 프로필 화면이 아직 없어 링크가 아니다. 프로필이 생기면 링크로 바꾼다. */}
        <span className="text-sm font-semibold">{post.nick}</span>
        {/* 인덱서가 붙기 전까지 서버 holdingMonths가 null이라 항상 '보유 기간 미확인'입니다. */}
        <span
          className={`text-sm ${post.tier === "wallet" ? "text-text-primary" : "text-text-muted"}`}
        >
          {post.hold || "보유 기록 없음"}
        </span>
        <span className="flex-1" />
        <span className="text-xs text-text-muted tabular-nums">{stats(post)}</span>
      </div>
    </article>
  );
}
