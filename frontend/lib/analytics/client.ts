import type { PostHog } from "posthog-js";
import { config } from "@/lib/config";
import {
  SCHEMA_VERSION,
  eventProperties,
  scrub,
  sourceOf,
  type AnalyticsEvent,
  type Source,
} from "./events";

/**
 * 이용 기록 전송 (HODL-89). **화면 코드는 `posthog-js` 를 직접 부르지 않고 이 파일만 거친다.**
 *
 * - 꺼져 있으면(`NEXT_PUBLIC_ANALYTICS_ENABLED` 가 `true` 가 아니거나 키가 없음) 아무것도 하지 않는다.
 *   SDK 도 내려받지 않는다.
 * - SDK 는 처음 보낼 때 한 번만 불러와 초기화한다. 서버 렌더에서는 건드리지 않는다.
 * - 자동 클릭 수집 · 자동 페이지뷰 · 세션 녹화 · 설문 · 기능 플래그는 끈다. 이벤트는 `events.ts` 의 명세대로만 보낸다.
 * - 전송은 화면 동작과 분리한다. SDK 를 못 불러오거나 전송이 실패해도 예외가 밖으로 나가지 않는다.
 */

let loading: Promise<PostHog | null> | null = null;

function client(): Promise<PostHog | null> | null {
  if (typeof window === "undefined" || !config.analytics.enabled) return null;

  loading ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(config.analytics.key, {
        api_host: config.analytics.host,
        autocapture: false,
        rageclick: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_exceptions: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        advanced_disable_flags: true,
        // 원격 스크립트를 더 내려받지 않는다(녹화 · 설문 등). CSP 를 넓힐 필요가 없다.
        disable_external_dependency_loading: true,
        save_referrer: false,
        save_campaign_params: false,
        mask_personal_data_properties: true,
        // 비로그인 방문에는 사람 프로필을 만들지 않는다.
        person_profiles: "identified_only",
        respect_dnt: true,
        before_send: scrub,
      });
      return posthog;
    })
    .catch(() => null);

  return loading;
}

function run(action: (posthog: PostHog) => void): void {
  void client()
    ?.then((posthog) => {
      if (posthog) action(posthog);
    })
    .catch(() => undefined);
}

/** 이벤트 한 건. 명세에 안 맞는 값이면 조용히 버린다. */
export function track(event: AnalyticsEvent): void {
  const properties = eventProperties(event);
  if (!properties) return;

  run((posthog) =>
    posthog.capture(event.name, {
      ...properties,
      // 재전송해도 같은 값이 유지된다. `scrub` 이 PostHog 의 중복 제거 식별자로 옮긴다.
      event_id: crypto.randomUUID(),
      occurred_at: new Date().toISOString(),
      environment: config.analytics.environment,
      schema_version: SCHEMA_VERSION,
    }),
  );
}

/**
 * 로그인한 회원을 분석용 식별자로 잇는다. 이메일 · 닉네임 · 지갑 주소 · 회원 번호를 넣지 않는다 —
 * 서버가 정해 준 분석 전용 식별자만 받는다. 없으면(null) 아무것도 하지 않고 익명으로 남는다.
 */
export function identify(analyticsId: string | null): void {
  if (!analyticsId) return;
  run((posthog) => {
    if (posthog.get_distinct_id() !== analyticsId) posthog.identify(analyticsId);
  });
}

/** 로그아웃. 같은 브라우저의 다음 사용자 행동이 이전 계정에 붙지 않게 식별 상태를 지운다. */
export function resetIdentity(): void {
  run((posthog) => posthog.reset());
}

/**
 * 사이트 안에서 지나온 화면. `source` 를 만들 때만 쓰고 어디에도 보내지 않는다.
 * `RouteTracker` 가 경로가 바뀔 때마다 적는다.
 */
const trail: { current: string | null; previous: string | null } = {
  current: null,
  previous: null,
};

export function recordPath(path: string): void {
  if (trail.current === path) return;
  trail.previous = trail.current;
  trail.current = path;
}

/**
 * 지금 화면(`ownPath`)에 오기 직전 화면의 종류.
 * 화면 쪽 effect 가 `RouteTracker` 보다 먼저 돌면 `current` 가 아직 이전 화면이라, 그때는 그것이 직전 화면이다.
 */
export function currentSource(ownPath: string): Source {
  return sourceOf(trail.current === ownPath ? trail.previous : trail.current);
}
