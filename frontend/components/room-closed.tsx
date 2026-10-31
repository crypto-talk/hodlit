import Link from "next/link";

export default function RoomClosed({ symbol }: { symbol: string }) {
  return (
    <section
      className="space-y-4 rounded-lg border border-border-subtle bg-surface p-8 text-center"
      aria-label="공사 중인 방"
    >
      <h1 className="text-h1 font-semibold">{symbol} 방은 공사 중입니다</h1>
      <p className="text-text-muted">준비가 끝나면 다시 이용할 수 있습니다.</p>
      <Link
        href="/subhodl/ETH"
        className="inline-block rounded border border-border-subtle px-4 py-2 font-semibold text-brand"
      >
        ETH 방으로 이동
      </Link>
    </section>
  );
}
