"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { currentSource, recordPath, track } from "./client";
import { eventKey, type AnalyticsEvent } from "./events";

/** `source` 는 여기서 채운다. 화면은 무엇이 보였는지만 말한다. */
type ViewEvent = AnalyticsEvent extends infer E
  ? E extends unknown
    ? Omit<E, "source">
    : never
  : never;

/**
 * 화면이 실제로 보였을 때 한 번 보낸다 (HODL-89). `event` 가 null 이면(아직 불러오는 중 · 오류) 보내지 않는다.
 *
 * 같은 내용으로 다시 그려지거나 개발 모드에서 effect 가 두 번 돌아도 한 번만 센다.
 * 다른 화면에 갔다 돌아오면 컴포넌트가 새로 붙으므로 다시 센다(실제 재방문).
 */
export function useTrackView(event: ViewEvent | null): void {
  const pathname = usePathname();
  const sent = useRef<string | null>(null);
  const key = event ? eventKey({ ...event, source: "other" } as AnalyticsEvent) : null;

  useEffect(() => {
    if (!event || !key || sent.current === key) return;
    sent.current = key;
    track({ ...event, source: currentSource(pathname) } as AnalyticsEvent);
    // key 가 event 의 내용을 대신한다. event 객체는 그릴 때마다 새로 만들어진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname]);
}

/** 서버 컴포넌트 안에서 쓰는 모양. 아무것도 그리지 않는다. */
export function TrackView({ event }: { event: ViewEvent }) {
  useTrackView(event);
  return null;
}

/** 지나온 화면을 적는다. `app/providers.tsx` 에 한 번만 둔다. */
export function RouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    recordPath(pathname);
  }, [pathname]);
  return null;
}
