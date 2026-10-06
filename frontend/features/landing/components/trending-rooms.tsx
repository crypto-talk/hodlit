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
      <div className="flex items-center gap-2">
        <h2 className="text-h1 font-semibold">지금 뜨는 방</h2>
        <span
          className="flex size-4 flex-none cursor-help items-center justify-center rounded-full border border-border-subtle text-xs text-text-muted"
          title="글·댓글 수 기준이며 시세와 무관합니다"
        >
          i
        </span>
        <div className="flex-1" />
        <a href="#" className="hidden text-sm font-semibold text-brand max-shell:block">
          전체 방
        </a>
      </div>

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {podium.map((room, index) => {
          const style = PODIUM_STYLE[index];
          return (
            <div
              key={room.symbol}
              className="animate-fade-in rounded-lg border border-border-subtle p-4 motion-reduce:animate-none"
              style={{ background: style.bg, animationDelay: `${index * 0.12}s` }}
            >
              <a href="#" className="block" style={{ color: style.ink }}>
                <div
                  className="text-display font-semibold tabular-nums"
                  style={{ color: style.rankColor }}
                >
                  {room.rank}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
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
                <div className="mt-2 text-sm tabular-nums" style={{ color: style.subInk }}>
                  {meta(room)}
                </div>
              </a>
              <a href="#" className="mt-4 block text-sm" style={{ color: style.subInk }}>
                {room.latest}
              </a>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col">
        {rest.map((room) => (
          <div key={room.symbol} className="border-t border-border-subtle py-4">
            <a href="#" className="flex items-baseline gap-4 text-inherit">
              <span className="w-6 flex-none text-sm text-text-muted tabular-nums">
                {room.rank}
              </span>
              <span className="flex-none text-body font-semibold">{room.symbol}</span>
              {room.hot ? (
                <span className="flex-none text-body text-brand" aria-label="상승 중">
                  ▲
                </span>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{room.name}</span>
              <span className="flex-none text-sm text-text-muted tabular-nums">{meta(room)}</span>
            </a>
            <a href="#" className="mt-2 ml-10 block text-sm text-text-muted">
              {room.latest}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
