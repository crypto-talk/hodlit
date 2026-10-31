"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format/time";
import { newsHref } from "@/lib/routes";
import { ROOM_NEWS_PREVIEW_SIZE } from "../api";
import { useRoomNews } from "../hooks/use-room-news";
import type { RoomNewsItem } from "../types";

type Props = {
  symbol: string;
};

/**
 * 방 게시판의 뉴스 칸 (HODL-62). [뉴스 | 투표] 2분할 중 왼쪽(구조 결정 G).
 *
 * 최근 뉴스 몇 개를 **제목 한 줄씩**만 보여 준다. 요약까지 그리면 칸이 시세 · 차트와 글 목록 사이에서
 * 너무 커진다(10-31 성지, 레이아웃 A안). 요약과 지난 뉴스는 "더보기" → 뉴스 페이지(`/subhodl/[symbol]/news`).
 * 칸 안에서 쪽을 넘기던 것은 뺐다 — 3건 이하면 버튼이 안 보여 있는지도 몰랐다.
 *
 * 제목은 원문(새 탭) 링크다. 시각은 기사 시각이 아니라 관리자가 등록한 시각이다.
 */
export default function RoomNews({ symbol }: Props) {
  const news = useRoomNews(symbol, 1, ROOM_NEWS_PREVIEW_SIZE);
  const total = news.data?.totalItems ?? 0;

  return (
    <section aria-label="뉴스" className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-body font-semibold text-text-primary">뉴스</h2>
        {total > 0 ? (
          <span className="text-xs text-text-muted tabular-nums">
            {total.toLocaleString("ko-KR")}건
          </span>
        ) : null}
        {total > 0 ? (
          <Link
            href={newsHref(symbol)}
            className="ml-auto inline-flex items-center text-xs text-text-muted hover:text-brand"
          >
            더보기
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
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
        <ul className="mt-1 flex flex-col divide-y divide-border-subtle">
          {news.data.items.map((item) => (
            <NewsLine key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NewsLine({ item }: { item: RoomNewsItem }) {
  const added = formatRelativeTime(item.createdAt);
  const title = <span className="min-w-0 flex-1 truncate">{item.title}</span>;

  return (
    <li className="flex items-baseline gap-3 py-2 text-sm">
      {item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          // 잘린 제목은 마우스를 올리면 전체가 보인다.
          title={item.title}
          className="flex min-w-0 flex-1 text-text-primary hover:text-brand"
        >
          {title}
        </a>
      ) : (
        <span title={item.title} className="flex min-w-0 flex-1 text-text-primary">
          {title}
        </span>
      )}
      {added ? (
        <span className="flex-none text-xs text-text-subtle tabular-nums">{added}</span>
      ) : null}
    </li>
  );
}
