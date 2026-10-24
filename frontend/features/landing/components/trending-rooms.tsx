import Link from "next/link";
import { roomHref } from "@/lib/routes";
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
  },
  {
    bg: "var(--brand-soft)",
    ink: "var(--text-primary)",
    subInk: "var(--text-primary)",
    rankColor: "var(--brand)",
  },
  {
    bg: "var(--surface-muted)",
    ink: "var(--text-primary)",
    subInk: "var(--text-muted)",
    rankColor: "var(--brand)",
  },
];

type Props = {
  /** 아직 못 받았으면 null. */
  rooms: TrendingRoom[] | null;
  failed: boolean;
  onRetry: () => void;
};

const meta = (room: TrendingRoom) =>
  `${room.participants}명 참여 · 글 ${room.posts} · 댓글 ${room.comments}`;

/**
 * 지금 뜨는 방. 순위와 숫자는 `GET /communities/stats?window=24h` 가 준다(HODL-44).
 *
 * 예전 목데이터에 있던 "최근 글 제목"과 상승 화살표는 통계 응답에 없어서 뺐다. 지어내지 않는다(G-5).
 * 활동이 있는 방이 없으면 빈 칸이 아니라 그렇다고 말한다.
 */
export default function TrendingRooms({ rooms, failed, onRetry }: Props) {
  const list = rooms ?? [];
  const podium = list.slice(0, 3);
  const rest = list.slice(3);

  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-h1 font-semibold">지금 뜨는 방</h2>
        <span
          className="flex size-4 flex-none cursor-help items-center justify-center rounded-full border border-border-subtle text-xs text-text-muted"
          title="최근 24시간 동안 글·댓글·좋아요를 남긴 사람 수 기준이며 시세와 무관합니다"
        >
          i
        </span>
        <div className="flex-1" />
        <a href="#" className="hidden text-sm font-semibold text-brand max-shell:block">
          전체 방
        </a>
      </div>

      {failed ? (
        <p className="mt-4 text-sm text-text-muted">
          뜨는 방을 불러오지 못했습니다.{" "}
          <button type="button" className="font-semibold text-brand" onClick={onRetry}>
            다시 시도
          </button>
        </p>
      ) : null}

      {!failed && rooms === null ? (
        <p className="mt-4 text-sm text-text-muted">불러오는 중…</p>
      ) : null}

      {rooms !== null && rooms.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border-subtle bg-surface p-6 text-center text-sm text-text-muted">
          최근 24시간 동안 활동이 있는 방이 아직 없습니다.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {podium.map((room, index) => {
          const style = PODIUM_STYLE[index];
          return (
            <div
              key={room.symbol}
              className="animate-fade-in rounded-lg border border-border-subtle p-4 motion-reduce:animate-none"
              style={{ background: style.bg, animationDelay: `${index * 0.12}s` }}
            >
              <Link href={roomHref(room.symbol)} className="block" style={{ color: style.ink }}>
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
                </div>
                <div className="mt-2 text-sm tabular-nums" style={{ color: style.subInk }}>
                  {meta(room)}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className={rest.length > 0 ? "mt-6 flex flex-col" : "hidden"}>
        {rest.map((room) => (
          <div key={room.symbol} className="border-t border-border-subtle py-4">
            <Link href={roomHref(room.symbol)} className="flex items-baseline gap-4 text-inherit">
              <span className="w-6 flex-none text-sm text-text-muted tabular-nums">
                {room.rank}
              </span>
              <span className="flex-none text-body font-semibold">{room.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{room.name}</span>
              <span className="flex-none text-sm text-text-muted tabular-nums">{meta(room)}</span>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
