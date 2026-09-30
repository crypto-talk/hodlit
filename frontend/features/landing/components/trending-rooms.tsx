import type { TrendingRoom } from "../types";

/**
 * 1·2·3위 카드 배색. 순위마다 면과 글자색이 통째로 달라서 클래스로 가르는 것보다
 * 표로 두는 편이 읽힌다. 값은 tokens.css 의 토큰을 가리킨다.
 */
const PODIUM_STYLE = [
  {
    bg: "var(--brand)",
    ink: "var(--text-inverse)",
    subInk: "var(--text-inverse)",
    rankColor: "var(--text-inverse)",
    arrowColor: "var(--text-inverse)",
  },
  {
    bg: "var(--brand-soft)",
    ink: "var(--text-primary)",
    subInk: "var(--text-primary)",
    rankColor: "var(--brand)",
    arrowColor: "var(--brand)",
  },
  {
    bg: "var(--surface-muted)",
    ink: "var(--text-primary)",
    subInk: "var(--text-muted)",
    rankColor: "var(--brand)",
    arrowColor: "var(--brand)",
  },
];

type Props = {
  rooms: TrendingRoom[];
};

const meta = (room: TrendingRoom) => `글 ${room.posts} · 댓글 ${room.comments}`;

export default function TrendingRooms({ rooms }: Props) {
  const podium = rooms.slice(0, 3);
  const rest = rooms.slice(3);

  return (
    <section>
      <div className="hd-section-head">
        <h2 className="text-h1 font-semibold">지금 뜨는 방</h2>
        <span className="hd-info" title="글·댓글 수 기준이며 시세와 무관합니다">
          i
        </span>
        <div style={{ flex: 1 }} />
        <a href="#" className="hidden text-sm font-semibold text-brand max-shell:block">
          전체 방
        </a>
      </div>

      <div className="hd-podium">
        {podium.map((room, index) => {
          const style = PODIUM_STYLE[index];
          return (
            <div
              key={room.symbol}
              className="hd-podium-card"
              style={{ background: style.bg, animationDelay: `${index * 0.12}s` }}
            >
              <a href="#" style={{ display: "block", color: style.ink }}>
                <div
                  className="text-display font-semibold tabular-nums"
                  style={{ color: style.rankColor }}
                >
                  {room.rank}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <span className="text-h1 font-semibold" style={{ color: style.ink }}>
                    {room.symbol}
                  </span>
                  <span className="text-body" style={{ color: style.subInk }}>
                    {room.name}
                  </span>
                  {room.hot ? (
                    <span
                      className="text-body"
                      style={{ color: style.arrowColor }}
                      aria-label="상승 중"
                    >
                      ▲
                    </span>
                  ) : null}
                </div>
                <div className="text-sm tabular-nums" style={{ marginTop: 8, color: style.subInk }}>
                  {meta(room)}
                </div>
              </a>
              <a
                href="#"
                className="text-sm"
                style={{ display: "block", marginTop: 16, color: style.subInk }}
              >
                {room.latest}
              </a>
            </div>
          );
        })}
      </div>

      <div className="hd-rest">
        {rest.map((room) => (
          <div key={room.symbol} className="hd-rest-row">
            <a href="#" className="hd-rest-line">
              <span
                className="text-sm text-text-muted tabular-nums"
                style={{ width: 24, flex: "0 0 auto" }}
              >
                {room.rank}
              </span>
              <span className="text-body font-semibold" style={{ flex: "0 0 auto" }}>
                {room.symbol}
              </span>
              {room.hot ? (
                <span
                  className="text-body"
                  style={{ color: "var(--hd-purple)", flex: "0 0 auto" }}
                  aria-label="상승 중"
                >
                  ▲
                </span>
              ) : null}
              <span className="text-sm text-text-muted truncate" style={{ flex: 1, minWidth: 0 }}>
                {room.name}
              </span>
              <span className="text-sm text-text-muted tabular-nums" style={{ flex: "0 0 auto" }}>
                {meta(room)}
              </span>
            </a>
            <a href="#" className="hd-rest-latest">
              {room.latest}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
