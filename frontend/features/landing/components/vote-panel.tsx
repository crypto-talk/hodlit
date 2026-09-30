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
      <div className="hd-section-head">
        <h2 className="text-h2 font-semibold">오늘의 투표 현황</h2>
        <span className="hd-info" title="내일 오를까 투표이며 표본이 적으면 사람 수로 표시합니다">
          i
        </span>
      </div>

      <div className="hd-vote-list">
        {votes.map((vote) => (
          <div key={vote.symbol} className="hd-vote-row">
            <div className="text-h2 font-semibold" style={{ width: 48, flex: "0 0 48px" }}>
              {vote.symbol}
            </div>

            <div className="hd-vote-bargroup">
              <div className="text-xs text-text-muted hd-vote-name">전체</div>
              <div className="hd-bar hd-bar-all">
                <div
                  className="hd-bar-fill"
                  style={{ width: vote.allWidth, background: "var(--hd-lilac)" }}
                />
              </div>
              <div className="text-xs text-text-muted tabular-nums hd-vote-value">
                {vote.allLabel}
              </div>
            </div>

            <div className="hd-vote-bargroup">
              <div className="text-xs font-semibold hd-vote-name">보유자</div>
              <div className="hd-bar hd-bar-holder">
                <div
                  className="hd-bar-fill"
                  style={{ width: vote.holderWidth, background: "var(--hd-purple)" }}
                />
              </div>
              <div className="text-sm font-semibold tabular-nums hd-vote-value">
                {vote.holderLabel}
              </div>
            </div>

            <button type="button" className="hd-link-button" onClick={onVote}>
              투표
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
