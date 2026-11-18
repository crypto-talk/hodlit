import type { components } from "@/lib/api-schema";
import { http } from "@/lib/http";
import { imageSrc } from "@/lib/media";
import type { DrawEvent, DrawPrize, DrawResult } from "./types";

/**
 * 뽑기 이벤트 (HODL-94 · 95, `docs/ASSIGNED_FEATURES_API.md`). 구조 규칙 2: 데이터 진입점은 여기 하나.
 *
 * 서버 규칙
 *   - 회원 · 이벤트당 한 번. 무엇이 나올지는 서버가 정하고 저장한다. 프론트는 고르지 않는다
 *   - `POST …/draw` 를 다시 보내면 **새로 뽑지 않고** 처음 결과를 그대로 돌려준다(`existing: true`).
 *     그래서 응답을 못 받았을 때 다시 보내도 결과가 바뀌지 않는다
 *   - 결과는 "무엇이 나왔는지"의 기록일 뿐이다. 배송 · 쿠폰 · 포인트 지급은 이 API 에 없다
 *
 * ⚠️ 생성 타입은 모든 필드가 선택(`?`)이다. 여기서 한 번 좁힌다.
 */

type PublicEvent = components["schemas"]["PublicEvent"];
type PublicPrize = components["schemas"]["PublicPrize"];
type Participation = components["schemas"]["Participation"];
type DrawOutcome = components["schemas"]["DrawOutcome"];

export function drawEventQueryKey(eventId: number) {
  return ["draw-event", eventId] as const;
}

/** 내 결과는 회원마다 다르다. 계정이 바뀌면 키가 바뀌어 이전 계정의 결과가 남지 않는다. */
export function drawResultQueryKey(eventId: number, memberId: number | null) {
  return ["draw-result", eventId, memberId] as const;
}

/** 이벤트 안내. 공개 API 다. 없는 이벤트 · 아직 공개 전인 초안은 404. */
export async function loadDrawEvent(eventId: number): Promise<DrawEvent> {
  return toDrawEvent(await http<PublicEvent>(`/api/v1/draw-events/${eventId}`));
}

/** 내 결과. 아직 참여하지 않았으면 null. 로그인이 필요하다. */
export async function loadDrawResult(eventId: number): Promise<DrawResult | null> {
  const participation = await http<Participation>(`/api/v1/draw-events/${eventId}/me`);
  return participation.result ? toDrawResult(participation.result) : null;
}

/** 뽑는다. 이미 참여했으면 처음 결과가 그대로 온다. 보낼 값은 없다 — 서버가 정한다. */
export async function draw(eventId: number): Promise<DrawResult> {
  const outcome = await http<DrawOutcome>(`/api/v1/draw-events/${eventId}/draw`, {
    method: "POST",
  });
  const result = toDrawResult(outcome);
  if (!result) throw new Error("뽑기 응답에 결과가 없습니다.");
  return result;
}

export function toDrawEvent(raw: PublicEvent): DrawEvent {
  if (typeof raw.id !== "number" || !raw.title) {
    throw new Error("이벤트 응답에 필요한 값이 없습니다.");
  }
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? "",
    startsAt: raw.startsAt ?? "",
    endsAt: raw.endsAt ?? "",
    status: raw.status ?? "",
    canParticipate: raw.canParticipate === true,
    prizes: [...(raw.prizes ?? [])]
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .flatMap(toPrize),
  };
}

function toPrize(raw: PublicPrize): DrawPrize[] {
  if (typeof raw.id !== "number" || !raw.name) return [];
  return [
    {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? "",
      image: imageSrc(raw.imageUrl),
    },
  ];
}

/** 상품 이름이 없는 결과는 결과로 치지 않는다. 그럴듯하게 채우지 않는다. */
export function toDrawResult(raw: DrawOutcome): DrawResult | null {
  if (typeof raw.id !== "number" || !raw.prizeName) return null;
  return {
    id: raw.id,
    prizeName: raw.prizeName,
    image: imageSrc(raw.imageUrl),
    capturedAt: raw.capturedAt ?? "",
  };
}
