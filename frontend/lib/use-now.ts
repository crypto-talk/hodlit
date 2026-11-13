"use client";

import { useEffect, useState } from "react";

/**
 * 지금 시각(ms). `intervalMs` 마다 다시 본다.
 *
 * 렌더 중에 `Date.now()` 를 부르면 그릴 때마다 값이 달라져 린트(`react-hooks/purity`)가 막는다.
 * 시각으로 상태를 가르는 화면(뽑기 참여 · 관리자 뽑기 관리)은 이 값을 받아 쓴다.
 * 정확한 판정은 서버가 한다 — 화면은 안내만 바꾼다.
 *
 * 뽑기 참여 화면(`features/draw`)에 있던 것을 관리자 화면도 쓰게 되어 여기로 내렸다.
 * features 끼리는 서로 가져올 수 없다(구조 규칙 1).
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
