/** 뽑기 이벤트의 상품 안내. 당첨 확률(가중치)은 공개 응답에 없다. */
export type DrawPrize = {
  id: number;
  name: string;
  description: string;
  /** 화면에 띄울 수 있게 바꾼 이미지 주소. 없거나 쓸 수 없으면 null. */
  image: string | null;
};

/** 뽑기 이벤트 (`GET /draw-events/{id}`). */
export type DrawEvent = {
  id: number;
  title: string;
  description: string;
  /** UTC ISO-8601. */
  startsAt: string;
  endsAt: string;
  /** `ACTIVE` | `PAUSED`. 초안은 공개 조회가 404 라 여기 오지 않는다. */
  status: string;
  /** 지금 참여할 수 있는지. 서버가 기간과 상태를 보고 정한 값이다. */
  canParticipate: boolean;
  prizes: DrawPrize[];
};

/** 내 뽑기 결과. 한 번 정해지면 바뀌지 않는다. */
export type DrawResult = {
  id: number;
  prizeName: string;
  image: string | null;
  /** 결과가 확정된 시각. UTC ISO-8601. */
  capturedAt: string;
};

/**
 * 화면이 보여 줄 상태.
 *
 * - `done`    이미 참여했다. 결과를 보여 준다. 이벤트가 끝났거나 멈췄어도 결과는 보인다
 * - `open`    지금 참여할 수 있다
 * - `before`  아직 시작 전
 * - `ended`   기간이 끝났다
 * - `paused`  운영진이 잠시 멈췄다(기간 안인데 참여 불가)
 */
export type DrawPhase = "done" | "open" | "before" | "ended" | "paused";
