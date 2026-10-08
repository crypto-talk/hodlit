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
const stats = (post: PostSummary) => {
  const base = `좋아요 ${post.likes} · 댓글 ${post.comments}`;
  return post.views === null ? base : `${base} · 조회 ${post.views.toLocaleString("en-US")}`;
};

/**
 * 글 목록 카드. 랜딩 전체 글과 방 게시판이 같이 쓴다.
 *
 * 첫 줄은 글쓴이 줄이다 — [방] 닉네임 · 배지 · 수량 구간 · 보유 기간 · 시각.
 * 배지는 "이 사람이 보유 중인가" 라 사람 옆에 둔다(댓글과 같은 순서). 닉네임은
 * 항상 있으니 배지가 없는 글도 첫 줄이 비지 않고, 제목 높이가 글마다 같다.
 *
 * 미인증은 미보유와 같은 회색 테두리 칩이다(사실만 같은 무게로).
 * 인증을 지원하지 않는 코인(BTC 등)의 글에는 아무것도 붙이지 않는다. 방 전체가
 * 미지원이라 카드마다 반복하면 소음이고, 그 사실은 방 머리와 글 상세가 말한다.
 *
 * 데이터는 `lib/post-summary.ts` 의 `toPostSummary()` 가 만든다.
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
        {/* 공개 프로필 화면이 아직 없어 링크가 아니다. 프로필이 생기면 링크로 바꾼다. */}
        <span className="text-sm font-semibold text-text-primary">{post.nick}</span>
        {post.verifiable ? <TierBadge tier={post.tier} symbol={post.symbol} /> : null}
        {post.range ? (
          <span className="flex-none rounded-sm border border-border-subtle px-2 py-0.5 text-xs text-text-muted tabular-nums">
            {post.range}
          </span>
        ) : null}
        {/* 인덱서가 붙기 전까지 서버 holdingMonths 가 null 이라 항상 '보유 기간 미확인'이다. */}
        {post.hold ? <span className="text-xs text-text-muted">{post.hold}</span> : null}
        <span className="flex-1" />
        <time dateTime={post.createdAt} className="text-xs text-text-muted">
          {post.time}
        </time>
      </div>

      <Link
        href={post.href}
        className="mt-2 block text-h2 font-semibold break-words text-text-primary hover:text-brand"
      >
        {post.title}
      </Link>
      {post.preview ? <p className="mt-2 text-body text-text-muted">{post.preview}</p> : null}

      <p className="mt-4 text-xs text-text-muted tabular-nums">{stats(post)}</p>
    </article>
  );
}
