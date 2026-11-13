"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PageLinks from "@/components/page-links";
import { coinNameKo } from "@/lib/coin-name-ko";
import { myVotesHref, roomHref } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { loadMyVotes, myVotesQueryKey } from "../history";
import { formatKstDate } from "../kst-label";
import ResultBars from "./result-bars";

/**
 * 마이페이지 내 투표 탭 `/mypage/votes` (HODL-109). 내가 고른 선택지와 그날의 결과.
 *
 * - 나만 본다. 남의 투표 기록을 보는 화면 · API 는 없다
 * - 그날 결과는 지금 집계다. 내가 참여한 날이라 오늘 것도 볼 수 있다
 * - 방이 닫혀도 내 기록은 남는다
 * - 기록이 없는 것(빈 목록)과 못 불러온 것(오류)을 다르게 보인다
 */
export default function MyVotes({ page }: { page: number }) {
  const { member } = useSession();
  const memberId = member?.id ?? null;
  const votes = useQuery({
    queryKey: myVotesQueryKey(memberId, page),
    queryFn: () => loadMyVotes(page),
    enabled: memberId !== null,
    placeholderData: keepPreviousData,
    retry: false,
  });

  if (votes.isPending) return <p className="text-sm text-text-muted">내 투표를 불러오는 중…</p>;

  if (votes.isError) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
        <p className="text-body font-semibold">내 투표 기록을 불러오지 못했습니다.</p>
        <p className="mt-1 text-sm text-text-muted">
          기록이 없는 것이 아니라 조회에 실패한 것입니다.
        </p>
        <button
          type="button"
          className="mt-4 cursor-pointer text-sm font-semibold text-brand"
          onClick={() => votes.refetch()}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (votes.data.items.length === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
        <p className="text-sm text-text-muted">
          {page > 1 ? "이 쪽에는 기록이 없습니다." : "아직 참여한 투표가 없습니다."}
        </p>
        <Link
          href={page > 1 ? myVotesHref() : "/"}
          className="mt-2 inline-block text-sm font-semibold text-brand"
        >
          {page > 1 ? "첫 쪽으로" : "오늘의 투표 보러 가기"}
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-text-muted">참여 {votes.data.totalElements}회 · 최근 순</p>
      <ul
        className={cn(
          "flex flex-col gap-4 transition-opacity",
          votes.isPlaceholderData && "opacity-60",
        )}
      >
        {votes.data.items.map((vote) => {
          const symbol = vote.result?.symbol ?? "";
          return (
            <li key={vote.id} className="rounded-lg border border-border-subtle bg-surface p-4">
              <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-text-muted">
                <time dateTime={vote.day}>{formatKstDate(vote.day)}</time>
                {symbol ? (
                  <Link href={roomHref(symbol)} className="font-semibold hover:text-brand">
                    {symbol} {coinNameKo(symbol, symbol)} 방
                  </Link>
                ) : null}
              </p>
              {vote.result ? (
                <>
                  <h2 className="mt-1 mb-3 text-body font-semibold break-words text-text-primary">
                    {vote.result.question}
                  </h2>
                  <ResultBars result={vote.result} myChoiceId={vote.choiceId} />
                </>
              ) : (
                <p className="mt-1 text-sm text-text-primary">
                  내 선택 <b className="font-semibold">{vote.choiceLabel}</b>
                  <span className="ml-2 text-xs text-text-muted">
                    그날 결과는 불러오지 못했습니다
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <PageLinks page={page} totalPages={votes.data.totalPages} hrefFor={myVotesHref} />
    </>
  );
}
