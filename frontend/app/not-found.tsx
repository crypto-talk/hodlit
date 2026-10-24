import Link from "next/link";

/**
 * 404 는 루트 하나만 둔다 (A-7).
 * 없는 방·없는 글은 각 페이지에서 `notFound()` 를 불러 여기로 떨어뜨린다.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-bold tracking-widest text-text-subtle">404</p>
      <h1 className="text-xl font-bold text-text-primary">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-text-muted">주소가 바뀌었거나 삭제된 글일 수 있습니다.</p>
      <Link
        href="/"
        className="rounded-md bg-brand px-4 py-2 text-sm font-bold text-text-inverse hover:bg-brand-hover"
      >
        홈으로
      </Link>
    </main>
  );
}
