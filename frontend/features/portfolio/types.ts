/**
 * 내 자산 포트폴리오 뷰 모델 (HODL-67).
 *
 * 서버(`GET /me/assets`)가 이미 같은 코인을 지갑 · 거래소에 걸쳐 합산하고 원화 평가금액을
 * 붙여 준다. 여기 모양은 그 결과를 원형 차트와 범례가 그대로 그릴 수 있게 좁힌 것이다.
 */

/** 원화 평가금액이 있는 코인 한 줄. 비중 계산에 들어간다. */
export type ValuedHolding = {
  symbol: string;
  name: string;
  quantity: number;
  valueKrw: number;
  /** 0~1. 평가금액이 있는 코인 합계 대비 비중. */
  share: number;
};

/** 원형 차트 한 조각. 상위 몇 개는 코인, 나머지는 "기타"로 묶는다. */
export type PortfolioSlice = {
  key: string;
  label: string;
  /** 범례 둘째 줄. 코인은 심볼, 기타는 묶인 코인 이름들. */
  detail: string;
  valueKrw: number;
  share: number;
  /** 0 부터 시작하는 색 칸 번호. 기타는 null(회색). */
  colorSlot: number | null;
};

/** 원화 평가금액을 받지 못해 비중에서 뺀 코인. */
export type UnpricedHolding = {
  symbol: string;
  name: string;
  quantity: number;
  /** 왜 금액이 없는지. */
  reason: "partial" | "price";
};

export type Portfolio = {
  /** 지갑이나 거래소가 하나라도 연결돼 있는지. */
  connected: boolean;
  totalKrw: number;
  /** 평가금액 큰 순. */
  holdings: ValuedHolding[];
  slices: PortfolioSlice[];
  unpriced: UnpricedHolding[];
  /** 일부 출처(지갑 네트워크 · 거래소) 조회에 실패한 코인 심볼. */
  incomplete: string[];
  /** 가장 최근에 잔액을 확인한 시각(ISO). 없으면 null. */
  capturedAt: string | null;
};
