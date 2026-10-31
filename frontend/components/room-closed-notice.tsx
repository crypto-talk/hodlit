import Link from "next/link";
import { roomHref } from "@/lib/routes";

type Props = {
  /** 닫힌 방. 모르면 "이 방" 이라고 쓴다. */
  symbol?: string | null;
  /** 무엇을 하려다 막혔는지. 글 상세 · 글 수정처럼 방 게시판이 아닌 곳에서 쓴다. */
  subject?: string;
  /** 대신 갈 수 있는 열린 방. 없거나 아직 못 받았으면 홈 링크만 남는다. */
  openRooms?: { symbol: string; name: string }[];
};

/**
 * 닫힌 방 안내 (HODL-77). 방 게시판 · 글 상세 · 글 수정이 같이 쓴다.
 *
 * 닫힌 방의 글은 지워진 것이 아니라 보존되어 있다. "없다" 가 아니라 "닫혀 있다" 고 말하고,
 * 열린 방으로 갈 길을 준다.
 */
export default function RoomClosedNotice({ symbol, subject, openRooms = [] }: Props) {
  const room = symbol ? `${symbol} 방` : "이 방";

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
      <p className="text-body font-semibold">
        {subject ? `${room}이 공사 중이라 ${subject}` : `${room}은 지금 공사 중입니다.`}
      </p>
      <p className="mt-1 text-sm text-text-muted">
        글은 그대로 보존되어 있고, 방이 다시 열리면 볼 수 있습니다.
      </p>

      {openRooms.length > 0 ? (
        <nav aria-label="열린 방" className="mt-5 flex flex-wrap justify-center gap-2">
          {openRooms.map((open) => (
            <Link
              key={open.symbol}
              href={roomHref(open.symbol)}
              className="rounded-sm border border-border-subtle bg-canvas px-3 py-1.5 text-sm font-semibold hover:border-text-muted"
            >
              {open.symbol} · {open.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand">
        홈으로
      </Link>
    </div>
  );
}
