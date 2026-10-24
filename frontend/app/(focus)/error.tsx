"use client";

import { useEffect } from "react";

/**
 * 페이지 로드 실패 안전망 (A-7).
 *
 * 여기까지 오는 건 페이지 전체가 못 그려진 경우다. 섹션 하나가 실패한 것은
 * 그 섹션 안에서 인라인으로 처리하고, 행동 실패(투표·발행)는 토스트로 간다.
 */
export default function GroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-lg font-bold text-text-primary">화면을 불러오지 못했습니다</h2>
      <p className="text-sm text-text-muted">잠시 후 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border-strong px-4 py-2 text-sm font-bold text-text-primary hover:bg-surface-muted"
      >
        다시 시도
      </button>
    </div>
  );
}
