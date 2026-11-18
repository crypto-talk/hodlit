"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import PageLinks from "@/components/page-links";
import RoomClosedNotice from "@/components/room-closed-notice";
import { coinNameKo } from "@/lib/coin-name-ko";
import { formatRelativeTime } from "@/lib/format/time";
import { ApiError } from "@/lib/http";
import { isRoomClosedError } from "@/lib/room-status";
import { newsHref, roomHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { NEWS_PAGE_SIZE } from "../api";
import { useRoomNews } from "../hooks/use-room-news";
import type { RoomNewsItem } from "../types";

type Props = {
  symbol: string;
  /** 1부터. */
  page: number;
};

/**
 * 방 뉴스 페이지 `/subhodl/[symbol]/news` — 방 게시판 뉴스 칸의 "더보기".
 *
 * 칸에서는 제목만 보이고, 여기서 요약 · 출처까지 본다. 10개씩 번호 페이지, 쪽은 주소(`?page=`)에 싣는다
 * (구조 규칙 8). 닫힌 방(HODL-77)이면 뉴스도 403 `ROOM_CLOSED` 라 닫힌 방 안내를 보인다.
 */
export default function NewsListPage({ symbol, page }: Props) {
  const news = useRoomNews(symbol, page, NEWS_PAGE_SIZE);
  const name = coinNameKo(symbol, symbol);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={roomHref(symbol)} className="text-sm text-text-muted hover:text-text-primary">
          ← {symbol} 방으로
        </Link>
        <h1 className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-h1 font-semibold text-text-primary">{symbol} 뉴스</span>
          <span className="text-body text-text-muted">{name}</span>
        </h1>
        <p className="mt-1 text-xs text-text-muted">
          운영진이 고른 기사의 짧은 요약입니다. 제목을 누르면 원문이 새 탭에서 열립니다.
        </p>
      </div>

      {news.isPending ? (
        <p className="text-sm text-text-muted">뉴스를 불러오는 중…</p>
      ) : news.isError ? (
        isRoomClosedError(news.error) ? (
          <RoomClosedNotice symbol={symbol} subject="뉴스를 볼 수 없습니다." />
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
            <p className="text-body font-semibold">
              {news.error instanceof ApiError && news.error.status === 404
                ? `${symbol} 방을 찾을 수 없습니다.`
                : "뉴스를 불러오지 못했습니다."}
            </p>
            <button
              type="button"
              className="mt-4 cursor-pointer text-sm font-semibold text-brand"
              onClick={() => news.refetch()}
            >
              다시 시도
            </button>
          </div>
        )
      ) : news.data.items.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">
            {page > 1 ? "이 쪽에는 뉴스가 없습니다." : "아직 등록된 뉴스가 없습니다."}
          </p>
          {page > 1 ? (
            <Link
              href={newsHref(symbol)}
              className="mt-2 inline-block text-sm font-semibold text-brand"
            >
              첫 쪽으로
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <ul
            className={cn(
              "flex flex-col divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface px-5 transition-opacity",
              news.isPlaceholderData && "opacity-60",
            )}
          >
            {news.data.items.map((item) => (
              <NewsRow key={item.id} item={item} />
            ))}
          </ul>
          <PageLinks
            page={page}
            totalPages={news.data.totalPages}
            hrefFor={(target) => newsHref(symbol, target)}
          />
        </>
      )}
    </div>
  );
}

function NewsRow({ item }: { item: RoomNewsItem }) {
  // 시각은 기사 시각이 아니라 관리자가 등록한 시각이다.
  const added = formatRelativeTime(item.createdAt);
  const meta = [item.sourceName ? `출처 ${item.sourceName}` : "", added ? `${added} 등록` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="py-4">
      {item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-start gap-1 text-body font-semibold text-text-primary hover:text-brand"
        >
          <span>{item.title}</span>
          <ExternalLink
            className="mt-1 size-3.5 flex-none text-text-muted group-hover:text-brand"
            aria-label="새 탭에서 원문 열기"
          />
        </a>
      ) : (
        <p className="text-body font-semibold text-text-primary">{item.title}</p>
      )}
      {item.summary ? <p className="mt-1 text-sm text-text-muted">{item.summary}</p> : null}
      {meta ? <p className="mt-2 text-xs text-text-subtle">{meta}</p> : null}
    </li>
  );
}
