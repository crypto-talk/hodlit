"use client";

import Link from "next/link";
import { roomHref } from "@/lib/routes";
import { useOpenPolls } from "../hooks/use-room-poll";
import RoomPoll from "./room-poll";

/** 칸으로 보여 줄 최대 수. 나머지는 방 링크만. */
const SHOWN = 2;

/**
 * 랜딩 "오늘의 투표" (HODL-64).
 *
 * 투표가 열린 방들을 방 게시판과 같은 칸(`room-poll.tsx`)으로 보여 준다. 여기서 바로 참여할 수 있다.
 * 세로 한 줄로 2개만 칸으로, 나머지는 방 이름 링크로 둔다(성지 결정, 2026-10-23).
 *
 * 순서는 하루 단위로 섞는다(`orderForDay`). 참여 전에는 표 수가 없어서 "큰 투표 순"으로 정렬할 수 없다.
 * 예전 목값의 "전체 vs 보유자" 막대는 뺐다. 투표 기록에 보유 상태가 남지 않아 서버가 줄 수 없다.
 */
export default function OpenPolls() {
  const polls = useOpenPolls();

  return (
    <section>
      <h2 className="text-h2 font-semibold">오늘의 투표</h2>

      {polls.isPending ? (
        <p className="mt-4 text-sm text-text-muted">불러오는 중…</p>
      ) : polls.isError ? (
        <div className="mt-4 rounded-lg border border-border-subtle bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">투표를 불러오지 못했습니다.</p>
          <button
            type="button"
            className="mt-2 cursor-pointer text-sm font-semibold text-brand"
            onClick={() => polls.refetch()}
          >
            다시 시도
          </button>
        </div>
      ) : polls.data.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border-subtle bg-surface p-6 text-center text-sm text-text-muted">
          지금 열린 투표가 없습니다.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-4">
            {polls.data.slice(0, SHOWN).map((symbol) => (
              <RoomPoll key={symbol} symbol={symbol} showRoom />
            ))}
          </div>
          {polls.data.length > SHOWN ? (
            <p className="mt-3 flex flex-wrap gap-x-2 text-sm text-text-muted">
              <span>다른 방 투표</span>
              {polls.data.slice(SHOWN).map((symbol) => (
                <Link key={symbol} href={roomHref(symbol)} className="font-semibold text-brand">
                  {symbol}
                </Link>
              ))}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
