"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { coinNameKo } from "@/lib/coin-name-ko";
import { formatShare } from "@/lib/format/number";
import { roomHref } from "@/lib/routes";
import { useRequireLogin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { canShowResults } from "../api";
import { useRoomPoll, useVote } from "../hooks/use-room-poll";
import type { RoomPoll as Poll } from "../types";

type Props = {
  symbol: string;
  /**
   * 랜딩처럼 여러 방의 투표를 모아 보일 때. 제목이 "오늘의 투표" 대신 방 이름(방 게시판 링크)이 되고,
   * 바깥 섹션 제목 아래에 들어가므로 h3 이다.
   */
  showRoom?: boolean;
};

/**
 * 방 투표 칸 (HODL-64). 방 게시판의 [뉴스 | 투표] 2분할 중 오른쪽(구조 결정 G)과
 * 랜딩 "오늘의 투표"(`open-polls.tsx`)가 같이 쓴다.
 *
 * - 참여 전: 질문과 선택지만. 결과(표 수 · 비율)는 없다 — 서버도 주지 않는다
 * - 참여 뒤: 오늘 결과. 다시 내거나 바꿀 수 없다
 * - 한국 자정이 지나면 결과를 지우고 다시 받는다. 같은 질문이면 다시 참여할 수 있다
 *
 * 보유자와 전체를 나눠 보여 주는 것은 아직 없다. 투표 기록에 투표자의 보유 상태가 남지 않아서다
 * (설계 원칙 5장 "투표 기록"). 백엔드에서 남기기 시작하면 결과에 줄을 더한다.
 */
export default function RoomPoll({ symbol, showRoom = false }: Props) {
  const poll = useRoomPoll(symbol);
  const room = showRoom ? symbol : null;

  if (poll.isPending) {
    return (
      <PollFrame room={room}>
        <p className="mt-2 text-sm text-text-muted">투표를 불러오는 중…</p>
      </PollFrame>
    );
  }

  if (poll.isError) {
    return (
      <PollFrame room={room}>
        <p className="mt-2 text-sm text-text-muted">투표를 불러오지 못했습니다.</p>
        <button
          type="button"
          className="mt-2 cursor-pointer text-sm font-semibold text-brand"
          onClick={() => poll.refetch()}
        >
          다시 시도
        </button>
      </PollFrame>
    );
  }

  if (!poll.data) {
    return (
      <PollFrame room={room}>
        <p className="mt-2 text-sm text-text-muted">지금 열린 투표가 없습니다.</p>
      </PollFrame>
    );
  }

  const data = poll.data;
  // 키가 날짜별이라 자정이 지나면 새로 받는다. 그래도 결과는 응답 날짜가 오늘과 같을 때만 그린다.
  return canShowResults(data, poll.today) ? (
    <PollFrame day={data.day} room={room}>
      <Results poll={data} />
    </PollFrame>
  ) : (
    <PollFrame day={data.day} room={room}>
      <Ballot
        key={`${data.id}-${data.day}`}
        poll={data}
        symbol={symbol}
        memberId={poll.memberId}
        today={poll.today}
      />
    </PollFrame>
  );
}

function PollFrame({
  day,
  room,
  children,
}: {
  day?: string;
  room: string | null;
  children: React.ReactNode;
}) {
  const Heading = room ? "h3" : "h2";
  return (
    <section
      aria-label={room ? `${room} 방 투표` : "투표"}
      className="rounded-lg border border-border-subtle bg-surface p-4"
    >
      <div className="flex items-baseline gap-2">
        <Heading className="text-body font-semibold text-text-primary">
          {room ? (
            <Link href={roomHref(room)} className="hover:text-brand">
              {room}{" "}
              <span className="font-normal text-text-muted">{coinNameKo(room, room)} 방</span>
            </Link>
          ) : (
            "오늘의 투표"
          )}
        </Heading>
        {day ? <span className="text-xs text-text-muted">{formatKstDay(day)}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * 참여 전. 선택지를 가로로 두고, 하나를 누르면 그 자리에서 한 번 더 확인한 뒤 낸다.
 *
 * 예전엔 세로 라디오 목록 + "투표하기" 버튼이라 칸이 높았다(10-31 레이아웃 A안으로 줄임).
 * 누르자마자 내지 않는 이유: 낸 뒤에는 바꿀 수 없어서 잘못 누른 것을 되돌릴 길이 없다.
 * 선택지가 많으면(최대 10개) 줄을 넘겨 감싼다.
 */
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
  const pickedChoice = poll.choices.find((choice) => choice.id === picked) ?? null;

  const pick = (choiceId: number) => {
    // 로그인 전이면 고르는 순간 로그인 화면으로. 확인까지 가서 막히면 두 번 누른 셈이다.
    if (requireLogin()) return;
    setPicked((current) => (current === choiceId ? null : choiceId));
  };

  const submit = () => {
    if (picked === null) return;
    vote.mutate({ pollId: poll.id, choiceId: picked });
  };

  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-text-primary">{poll.question}</p>

      <div role="radiogroup" aria-label={poll.question} className="mt-3 flex flex-wrap gap-2">
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
                "min-w-20 flex-1 cursor-pointer rounded-sm border px-3 py-2 text-center text-sm transition-colors disabled:cursor-default",
                on
                  ? "border-brand bg-brand-soft font-semibold text-text-primary"
                  : "border-border-subtle bg-surface text-text-primary hover:border-text-muted",
              )}
              onClick={() => pick(choice.id)}
            >
              {choice.label}
            </button>
          );
        })}
      </div>

      {pickedChoice ? (
        <div className="mt-3">
          <p className="text-xs text-text-muted">
            <b className="font-semibold text-text-primary">{pickedChoice.label}</b>로 참여할까요? 낸
            뒤에는 바꿀 수 없습니다.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" onClick={() => setPicked(null)} disabled={vote.isPending}>
              취소
            </Button>
            <Button type="button" variant="primary" onClick={submit} disabled={vote.isPending}>
              {vote.isPending ? "보내는 중…" : "참여"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-text-muted">참여하면 오늘 결과가 보입니다.</p>
      )}
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
