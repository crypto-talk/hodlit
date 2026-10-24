"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { formatRelativeTime } from "@/lib/format/time";
import { cn } from "@/lib/utils";
import { useRoomNews } from "../hooks/use-room-news";
import type { RoomNewsItem } from "../types";

type Props = {
  symbol: string;
};

const PAGER =
  "cursor-pointer rounded-sm px-2 py-1 text-xs text-text-muted hover:text-text-primary disabled:cursor-default disabled:opacity-40 disabled:hover:text-text-muted";

/**
 * 방 게시판의 뉴스 칸 (HODL-62). [뉴스 | 투표] 2분할 중 왼쪽(구조 결정 G).
 *
 * 관리자가 등록한 제목 · 짧은 요약 · 출처를 평문으로 보여 주고, 원문은 새 탭의 바깥 링크로 연다.
 * 최신순 3개씩(옆 투표 칸과 높이를 맞추려고), 칸 안에서 쪽을 넘긴다. 쪽은 주소에 넣지 않았다 — 방 게시판의 `?page=` 는 글 목록의 쪽이고,
 * 뉴스 칸의 쪽까지 주소에 남길 만큼 오래 머무는 목록이 아니라서다.
 */
export default function RoomNews({ symbol }: Props) {
  const [page, setPage] = useState(1);
  const news = useRoomNews(symbol, page);

  return (
    <section aria-label="뉴스" className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-body font-semibold text-text-primary">뉴스</h2>
        {news.data && news.data.totalItems > 0 ? (
          <span className="text-xs text-text-muted tabular-nums">
            {news.data.totalItems.toLocaleString("ko-KR")}건
          </span>
        ) : null}
      </div>

      {news.isPending ? (
        <p className="mt-2 text-sm text-text-muted">뉴스를 불러오는 중…</p>
      ) : news.isError ? (
        <div className="mt-2">
          <p className="text-sm text-text-muted">뉴스를 불러오지 못했습니다.</p>
          <button
            type="button"
            className="mt-2 cursor-pointer text-sm font-semibold text-brand"
            onClick={() => news.refetch()}
          >
            다시 시도
          </button>
        </div>
      ) : news.data.items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">아직 등록된 뉴스가 없습니다.</p>
      ) : (
        <>
          <ul
            className={cn(
              "mt-2 flex flex-col divide-y divide-border-subtle transition-opacity",
              news.isPlaceholderData && "opacity-60",
            )}
          >
            {news.data.items.map((item) => (
              <NewsRow key={item.id} item={item} />
            ))}
          </ul>

          {news.data.totalPages > 1 ? (
            <nav aria-label="뉴스 쪽 이동" className="mt-2 flex items-center justify-end gap-1">
              <button
                type="button"
                className={PAGER}
                disabled={page <= 1 || news.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                이전
              </button>
              <span className="text-xs text-text-muted tabular-nums">
                {page} / {news.data.totalPages}
              </span>
              <button
                type="button"
                className={PAGER}
                disabled={page >= news.data.totalPages || news.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                다음
              </button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

function NewsRow({ item }: { item: RoomNewsItem }) {
  // 시각은 기사 시각이 아니라 관리자가 등록한 시각이다.
  const added = formatRelativeTime(item.createdAt);
  const meta = [item.sourceName ? `출처 ${item.sourceName}` : "", added ? `${added} 등록` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="py-3 first:pt-1 last:pb-1">
      {item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-start gap-1 text-sm font-semibold text-text-primary hover:text-brand"
        >
          <span className="line-clamp-2">{item.title}</span>
          <ExternalLink
            className="mt-0.5 size-3.5 flex-none text-text-muted group-hover:text-brand"
            aria-label="새 탭에서 원문 열기"
          />
        </a>
      ) : (
        <p className="line-clamp-2 text-sm font-semibold text-text-primary">{item.title}</p>
      )}
      {item.summary ? (
        <p className="mt-1 line-clamp-2 text-sm text-text-muted">{item.summary}</p>
      ) : null}
      {meta ? <p className="mt-1 text-xs text-text-subtle">{meta}</p> : null}
    </li>
  );
}
