import Link from "next/link";

type Props = {
  /** 지금 쪽. 1부터. */
  page: number;
  totalPages: number;
  /** 쪽 번호 → 주소. 쪽은 주소에 싣는다(구조 규칙 8). */
  hrefFor: (page: number) => string;
};

/** 한 번에 보이는 쪽 번호 수. 지금 쪽이 가운데 오도록 앞뒤를 채운다. */
const WINDOW = 5;

const ITEM =
  "inline-flex min-w-9 items-center justify-center rounded-sm px-2 py-1.5 text-sm tabular-nums";

/**
 * 번호 페이지 쪽 이동 — 이전 · 번호 5개 · 다음. 방 게시판과 검색 결과가 같이 쓴다.
 *
 * 링크라서 새 탭 열기 · 뒤로 가기가 그대로 된다. 한 쪽뿐이면 그리지 않는다.
 */
export default function PageLinks({ page, totalPages, hrefFor }: Props) {
  if (totalPages <= 1) return null;

  const half = Math.floor(WINDOW / 2);
  const first = Math.max(1, Math.min(page - half, totalPages - WINDOW + 1));
  const last = Math.min(totalPages, first + WINDOW - 1);
  const pages = Array.from({ length: last - first + 1 }, (_, index) => first + index);

  return (
    <nav aria-label="쪽 이동" className="mt-4 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className={`${ITEM} text-text-muted hover:text-text-primary`}
        >
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
            href={hrefFor(target)}
            className={`${ITEM} text-text-muted hover:bg-surface hover:text-text-primary`}
          >
            {target}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={hrefFor(page + 1)}
          className={`${ITEM} text-text-muted hover:text-text-primary`}
        >
          다음
        </Link>
      ) : null}
    </nav>
  );
}
