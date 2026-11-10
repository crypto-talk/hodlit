"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PageLinks from "@/components/page-links";
import RoomClosedNotice from "@/components/room-closed-notice";
import { coinNameKo } from "@/lib/coin-name-ko";
import { ApiError } from "@/lib/http";
import { isRoomClosedError } from "@/lib/room-status";
import { pollResultsHref, roomHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { loadPollResults, pollResultsQueryKey } from "../history";
import { formatKstDate } from "../kst-label";
import ResultBars from "./result-bars";

type Props = {
  symbol: string;
  /** 1부터. */
  page: number;
};

/**
 * 방의 지난 투표 결과 `/subhodl/[symbol]/polls` (HODL-109) — 방 게시판 투표 칸의 "지난 결과".
 *
 * 한국 날짜별로 한 건씩, 최근 날짜부터. 질문 · 선택지별 표 수 · 전체 참여 수를 보이고, 보유자
 * 집계가 있으면 전체와 나란히 견준다. 10건씩 번호 페이지, 쪽은 주소(`?page=`)에 싣는다.
 *
 * **진행 중인 오늘 결과는 여기 없다.** 오늘 것은 오늘 참여한 사람만 투표 칸에서 본다.
 * 로그인 없이 볼 수 있다(공개 API). 닫힌 방이면 닫힌 방 안내를 보인다.
 */
export default function PollResultsPage({ symbol, page }: Props) {
  const results = useQuery({
    queryKey: pollResultsQueryKey(symbol, page),
    queryFn: () => loadPollResults(symbol, page),
    placeholderData: keepPreviousData,
    retry: false,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={roomHref(symbol)} className="text-sm text-text-muted hover:text-text-primary">
          ← {symbol} 방으로
        </Link>
        <h1 className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-h1 font-semibold text-text-primary">{symbol} 지난 투표</span>
          <span className="text-body text-text-muted">{coinNameKo(symbol, symbol)}</span>
        </h1>
        <p className="mt-1 text-xs text-text-muted">
          어제까지의 결과입니다. 오늘 투표의 결과는 오늘 참여한 뒤 방 게시판의 투표 칸에서 볼 수
          있습니다.
        </p>
      </div>

      {results.isPending ? (
        <p className="text-sm text-text-muted">지난 결과를 불러오는 중…</p>
      ) : results.isError ? (
        isRoomClosedError(results.error) ? (
          <RoomClosedNotice symbol={symbol} subject="투표 결과를 볼 수 없습니다." />
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
            <p className="text-body font-semibold">
              {results.error instanceof ApiError && results.error.status === 404
                ? `${symbol} 방을 찾을 수 없습니다.`
                : "지난 결과를 불러오지 못했습니다."}
            </p>
            <button
              type="button"
              className="mt-4 cursor-pointer text-sm font-semibold text-brand"
              onClick={() => results.refetch()}
            >
              다시 시도
            </button>
          </div>
        )
      ) : results.data.items.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">
            {page > 1
              ? "이 쪽에는 결과가 없습니다."
              : "아직 지난 결과가 없습니다. 참여가 있었던 날부터 여기 쌓입니다."}
          </p>
          {page > 1 ? (
            <Link
              href={pollResultsHref(symbol)}
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
              "flex flex-col gap-4 transition-opacity",
              results.isPlaceholderData && "opacity-60",
            )}
          >
            {results.data.items.map((item) => (
              <li
                key={`${item.pollId}-${item.day}`}
                className="rounded-lg border border-border-subtle bg-surface p-4"
              >
                <p className="text-xs text-text-muted">
                  <time dateTime={item.day}>{formatKstDate(item.day)}</time>
                </p>
                <h2 className="mt-1 mb-3 text-body font-semibold break-words text-text-primary">
                  {item.question}
                </h2>
                <ResultBars result={item} />
              </li>
            ))}
          </ul>
          <PageLinks
            page={page}
            totalPages={results.data.totalPages}
            hrefFor={(target) => pollResultsHref(symbol, target)}
          />
        </>
      )}
    </div>
  );
}
