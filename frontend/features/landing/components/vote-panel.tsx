import type { VoteRow } from "../types";

type Props = {
  votes: VoteRow[];
  onVote: () => void;
};

/**
 * 전체 표와 보유자 표를 나란히 보여줍니다.
 * 보유자 막대를 두껍게(16px) 둔 것은 그쪽이 이 서비스의 주장이기 때문입니다.
 */
export default function VotePanel({ votes, onVote }: Props) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-h2 font-semibold">오늘의 투표 현황</h2>
        <span
          className="flex size-4 flex-none cursor-help items-center justify-center rounded-full border border-border-subtle text-xs text-text-muted"
          title="내일 오를까 투표이며 표본이 적으면 사람 수로 표시합니다"
        >
          i
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-surface">
        {votes.map((vote) => (
          <div
            key={vote.symbol}
            className="flex flex-wrap items-center gap-4 border-b border-border-subtle p-4 last:border-b-0"
          >
            <div className="w-12 flex-none text-h2 font-semibold">{vote.symbol}</div>

            <div className="flex min-w-0 flex-1 basis-55 items-center gap-2">
              <div className="text-xs text-text-muted w-12 flex-none">전체</div>
              <div className="relative flex-1 overflow-hidden rounded-full bg-canvas h-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand-soft"
                  style={{ width: vote.allWidth }}
                />
              </div>
              <div className="text-xs text-text-muted tabular-nums w-24 flex-none text-right whitespace-nowrap">
                {vote.allLabel}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 basis-55 items-center gap-2">
              <div className="text-xs font-semibold w-12 flex-none">보유자</div>
              <div className="relative flex-1 overflow-hidden rounded-full bg-canvas h-4">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-brand"
                  style={{ width: vote.holderWidth }}
                />
              </div>
              <div className="text-sm font-semibold tabular-nums w-24 flex-none text-right whitespace-nowrap">
                {vote.holderLabel}
              </div>
            </div>

            <button
              type="button"
              className="cursor-pointer p-0 text-sm font-semibold text-brand"
              onClick={onVote}
            >
              투표
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
