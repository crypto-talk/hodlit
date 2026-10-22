"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatShare } from "@/lib/format/number";
import { useRequireLogin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { canShowResults } from "../api";
import { useRoomPoll, useVote } from "../hooks/use-room-poll";
import type { RoomPoll as Poll } from "../types";

type Props = {
  symbol: string;
};

/**
 * 방 게시판의 투표 칸 (HODL-64). 방 게시판의 [뉴스 | 투표] 2분할 중 오른쪽(구조 결정 G).
 *
 * - 참여 전: 질문과 선택지만. 결과(표 수 · 비율)는 없다 — 서버도 주지 않는다
 * - 참여 뒤: 오늘 결과. 다시 내거나 바꿀 수 없다
 * - 한국 자정이 지나면 결과를 지우고 다시 받는다. 같은 질문이면 다시 참여할 수 있다
 *
 * 보유자와 전체를 나눠 보여 주는 것은 아직 없다. 투표 기록에 투표자의 보유 상태가 남지 않아서다
 * (설계 원칙 5장 "투표 기록"). 백엔드에서 남기기 시작하면 결과에 줄을 더한다.
 */
export default function RoomPoll({ symbol }: Props) {
  const poll = useRoomPoll(symbol);

  if (poll.isPending) {
    return (
      <Frame>
        <p className="mt-2 text-sm text-text-muted">투표를 불러오는 중…</p>
      </Frame>
    );
  }

  if (poll.isError) {
    return (
      <Frame>
        <p className="mt-2 text-sm text-text-muted">투표를 불러오지 못했습니다.</p>
        <button
          type="button"
          className="mt-2 cursor-pointer text-sm font-semibold text-brand"
          onClick={() => poll.refetch()}
        >
          다시 시도
        </button>
      </Frame>
    );
  }

  if (!poll.data) {
    return (
      <Frame>
        <p className="mt-2 text-sm text-text-muted">지금 열린 투표가 없습니다.</p>
      </Frame>
    );
  }

  const data = poll.data;
  // 키가 날짜별이라 자정이 지나면 새로 받는다. 그래도 결과는 응답 날짜가 오늘과 같을 때만 그린다.
  return canShowResults(data, poll.today) ? (
    <Frame day={data.day}>
      <Results poll={data} />
    </Frame>
  ) : (
    <Frame day={data.day}>
      <Ballot
        key={`${data.id}-${data.day}`}
        poll={data}
        symbol={symbol}
        memberId={poll.memberId}
        today={poll.today}
      />
    </Frame>
  );
}

function Frame({ day, children }: { day?: string; children: React.ReactNode }) {
  return (
    <section aria-label="투표" className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-body font-semibold text-text-primary">오늘의 투표</h2>
        {day ? <span className="text-xs text-text-muted">{formatKstDay(day)}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** 참여 전. 하나를 고르고 낸다. */
function Ballot({
  poll,
  symbol,
  memberId,
  today,
}: {
  poll: Poll;
  symbol: string;
  memberId: number | null;
  today: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const requireLogin = useRequireLogin();
  const vote = useVote(symbol, memberId, today);

  const submit = () => {
    if (picked === null || requireLogin()) return;
    vote.mutate({ pollId: poll.id, choiceId: picked });
  };

  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-text-primary">{poll.question}</p>

      <div role="radiogroup" aria-label={poll.question} className="mt-3 flex flex-col gap-2">
        {poll.choices.map((choice) => {
          const on = picked === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={vote.isPending}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default",
                on
                  ? "border-brand bg-brand-soft font-semibold text-text-primary"
                  : "border-border-subtle bg-surface text-text-primary hover:border-text-muted",
              )}
              onClick={() => setPicked(choice.id)}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 flex-none items-center justify-center rounded-full border",
                  on ? "border-brand bg-brand text-text-inverse" : "border-border-strong",
                )}
              >
                {on ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              {choice.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="primary" disabled={picked === null || vote.isPending} onClick={submit}>
          {vote.isPending ? "보내는 중…" : "투표하기"}
        </Button>
        <p className="text-xs text-text-muted">
          참여하면 오늘 결과가 보입니다. 낸 뒤에는 바꿀 수 없습니다.
        </p>
      </div>
    </div>
  );
}

/** 참여 뒤. 오늘 하루치 결과. */
function Results({ poll }: { poll: Poll }) {
  const total = poll.totalVotes ?? 0;

  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-text-primary">{poll.question}</p>

      <ul className="mt-3 flex flex-col gap-3">
        {poll.choices.map((choice) => {
          const votes = choice.votes ?? 0;
          const share = total > 0 ? votes / total : 0;
          const mine = choice.id === poll.myChoiceId;
          return (
            <li key={choice.id}>
              <div className="flex items-baseline gap-2 text-sm">
                <span className={cn("min-w-0 flex-1", mine && "font-semibold")}>
                  {choice.label}
                  {mine ? <span className="ml-2 text-xs text-brand">내 선택</span> : null}
                </span>
                <span className="flex-none text-xs text-text-muted tabular-nums">
                  {votes.toLocaleString("ko-KR")}명
                </span>
                <span className="w-12 flex-none text-right font-semibold tabular-nums">
                  {formatShare(share)}
                </span>
              </div>
              <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-canvas">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    mine ? "bg-brand" : "bg-brand-soft",
                  )}
                  style={{ width: `${share * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-text-muted">
        오늘 {total.toLocaleString("ko-KR")}명 참여 · 내일 다시 참여할 수 있습니다.
      </p>
    </div>
  );
}

/** `2026-10-23` → `10월 23일`. 서버 날짜 문자열을 그대로 읽는다(시간대 변환 없음). */
function formatKstDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return month && date ? `${month}월 ${date}일` : day;
}
