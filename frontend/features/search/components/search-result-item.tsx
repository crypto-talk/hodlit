import Link from "next/link";
import { formatRelativeTime } from "@/lib/format/time";
import { commentHref, postHref, roomHref } from "@/lib/routes";
import type { SearchResult } from "../types";
import Highlighted from "./highlighted";

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  post: "글",
  comment: "댓글",
  room: "방",
  user: "사용자",
};

const CHIP =
  "flex-none rounded-sm border border-border-subtle bg-canvas px-2 py-0.5 text-xs font-semibold text-text-muted";

/**
 * 검색 결과 한 줄. 종류마다 이동할 곳이 다르다.
 *
 * - 글 → 글 상세, 댓글 → 글 상세의 그 댓글(`#comment-{id}`), 방 → 방 게시판
 * - 사용자 → 공개 프로필 화면(HODL-75)이 아직 없어 링크가 아니다. 생기면 링크로 바꾼다.
 *
 * 줄 전체가 링크다(누를 곳이 넓게). 안에 다른 링크를 두지 않는다.
 */
export default function SearchResultItem({ result, q }: { result: SearchResult; q: string }) {
  const box = "block rounded-lg border border-border-subtle bg-surface p-4";

  switch (result.kind) {
    case "post":
      return (
        <Link
          href={postHref(result.symbol, result.postId)}
          className={`${box} hover:border-text-muted`}
        >
          <Meta
            kind="post"
            symbol={result.symbol}
            author={result.author}
            q={q}
            at={result.createdAt}
          />
          <p className="mt-2 text-body font-semibold text-text-primary">
            <Highlighted text={result.title} q={q} />
          </p>
          {result.excerpt ? (
            <p className="mt-1 line-clamp-2 text-sm break-words text-text-muted">
              <Highlighted text={result.excerpt} q={q} />
            </p>
          ) : null}
        </Link>
      );
    case "comment":
      return (
        <Link
          href={commentHref(result.symbol, result.postId, result.commentId)}
          className={`${box} hover:border-text-muted`}
        >
          <Meta
            kind="comment"
            symbol={result.symbol}
            author={result.author}
            q={q}
            at={result.createdAt}
          />
          <p className="mt-2 line-clamp-3 text-sm break-words whitespace-pre-wrap text-text-primary">
            <Highlighted text={result.excerpt} q={q} />
          </p>
          <p className="mt-2 truncate text-xs text-text-muted">글 · {result.postTitle}</p>
        </Link>
      );
    case "room":
      return (
        <Link
          href={roomHref(result.symbol)}
          className={`${box} flex items-center gap-2 hover:border-text-muted`}
        >
          <span className={CHIP}>{KIND_LABEL.room}</span>
          <span className="text-body font-semibold text-text-primary">
            <Highlighted text={result.name} q={q} />
          </span>
          <span className="text-sm text-text-muted">
            <Highlighted text={result.symbol} q={q} />
          </span>
        </Link>
      );
    case "user":
      return (
        <div className={`${box} flex items-center gap-2`}>
          <span className={CHIP}>{KIND_LABEL.user}</span>
          <span className="text-body font-semibold text-text-primary">
            <Highlighted text={result.nickname} q={q} />
          </span>
          <span className="ml-auto text-xs text-text-muted">프로필 준비 중</span>
        </div>
      );
  }
}

function Meta({
  kind,
  symbol,
  author,
  q,
  at,
}: {
  kind: "post" | "comment";
  symbol: string;
  author: string;
  q: string;
  at: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
      <span className={CHIP}>{KIND_LABEL[kind]}</span>
      <span className="font-semibold">{symbol}</span>
      <span>
        <Highlighted text={author} q={q} />
      </span>
      {at ? <time dateTime={at}>· {formatRelativeTime(at)}</time> : null}
    </div>
  );
}
