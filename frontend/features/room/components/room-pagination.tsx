import Link from "next/link";
import { roomHref } from "@/lib/routes";

type Props = {
  symbol: string;
  tab: "all" | "verified";
  /** 지금 쪽. 1부터. */
  page: number;
  totalPages: number;
};

/** 한 번에 보이는 쪽 번호 수. 지금 쪽이 가운데 오도록 앞뒤를 채운다. */
const WINDOW = 5;

const ITEM =
  "inline-flex min-w-9 items-center justify-center rounded-sm px-2 py-1.5 text-sm tabular-nums";

/**
 * 방 게시판 쪽 번호 (HODL-66).
 *
 * 쪽은 주소의 `?page=` 다(구조 규칙 8). 링크라서 새 탭 열기 · 뒤로 가기가 그대로 된다.
 * 누르면 목록 머리(`#room-posts`)로 올라간다 — 맨 아래 번호를 누르고 새 쪽의 끝을 보고
 * 있게 되지 않도록.
 */
export default function RoomPagination({ symbol, tab, page, totalPages }: Props) {
  if (totalPages <= 1) return null;

  const tabParam = tab === "verified" ? "verified" : undefined;
  const href = (target: number) => `${roomHref(symbol, tabParam, target)}#room-posts`;

  const half = Math.floor(WINDOW / 2);
  const first = Math.max(1, Math.min(page - half, totalPages - WINDOW + 1));
  const last = Math.min(totalPages, first + WINDOW - 1);
  const pages = Array.from({ length: last - first + 1 }, (_, index) => first + index);

  return (
    <nav aria-label="쪽 이동" className="mt-4 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={`${ITEM} text-text-muted hover:text-text-primary`}>
          이전
        </Link>
      ) : null}

      {pages.map((target) =>
        target === page ? (
          <span
            key={target}
            aria-current="page"
            className={`${ITEM} bg-brand font-semibold text-text-inverse`}
          >
            {target}
          </span>
        ) : (
          <Link
            key={target}
            href={href(target)}
            className={`${ITEM} text-text-muted hover:bg-surface hover:text-text-primary`}
          >
            {target}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={href(page + 1)} className={`${ITEM} text-text-muted hover:text-text-primary`}>
          다음
        </Link>
      ) : null}
    </nav>
  );
}
