import { formatShare } from "@/lib/format/number";
import { cn } from "@/lib/utils";
import { shareOf } from "../history";
import type { DailyPollResult } from "../types";

type Props = {
  result: DailyPollResult;
  /** 내가 고른 선택지. 내 투표 기록에서만 준다. */
  myChoiceId?: number;
};

/**
 * 어느 날의 투표 결과 막대. 방의 지난 결과와 마이페이지 내 투표가 같이 쓴다.
 *
 * 보유자 집계가 있으면 선택지마다 막대 두 줄을 그린다 — 위는 전체, 아래는 그 코인을 들고 있다고
 * 확인된 사람만. "전체는 오른다는데 보유자는 내린다고 본다" 같은 차이가 이 서비스가 보여 주려는
 * 것이다(설계 원칙 6장). 보유자 수가 적으면 비율이 크게 흔들리므로 몇 명인지 같이 적는다.
 */
export default function ResultBars({ result, myChoiceId }: Props) {
  const holders = result.holders;

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {result.choices.map((choice) => {
          const share = shareOf(choice.votes, result.totalVotes);
          const mine = choice.id === myChoiceId;
          const holderVotes = holders?.choices.find((item) => item.id === choice.id)?.votes ?? 0;
          const holderShare = holders ? shareOf(holderVotes, holders.totalVotes) : 0;
          return (
            <li key={choice.id}>
              <div className="flex items-baseline gap-2 text-sm">
                <span className={cn("min-w-0 flex-1 break-words", mine && "font-semibold")}>
                  {choice.label}
                  {mine ? <span className="ml-2 text-xs text-brand">내 선택</span> : null}
                </span>
                <span className="flex-none text-xs text-text-muted tabular-nums">
                  {choice.votes.toLocaleString("ko-KR")}명
                </span>
                <span className="w-12 flex-none text-right font-semibold tabular-nums">
                  {formatShare(share)}
                </span>
              </div>
              <Bar share={share} tone={mine ? "strong" : "soft"} />
              {holders ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="w-12 flex-none text-xs text-text-muted">보유자</span>
                  <div className="min-w-0 flex-1">
                    <Bar share={holderShare} tone="holder" />
                  </div>
                  <span className="flex-none text-xs text-text-muted tabular-nums">
                    {holderVotes.toLocaleString("ko-KR")}명
                  </span>
                  <span className="w-12 flex-none text-right text-xs font-semibold tabular-nums">
                    {formatShare(holderShare)}
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-text-muted">
        전체 {result.totalVotes.toLocaleString("ko-KR")}명 참여
        {holders
          ? ` · 그중 보유 인증자 ${holders.totalVotes.toLocaleString("ko-KR")}명 (투표할 때 ${result.symbol} 보유가 확인된 사람)`
          : " · 보유 인증자 집계 없음"}
      </p>
    </div>
  );
}

const TONE = {
  strong: "bg-brand",
  soft: "bg-brand-soft",
  holder: "bg-text-primary",
} as const;

function Bar({ share, tone }: { share: number; tone: keyof typeof TONE }) {
  return (
    <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-canvas">
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full", TONE[tone])}
        style={{ width: `${share * 100}%` }}
      />
    </div>
  );
}
