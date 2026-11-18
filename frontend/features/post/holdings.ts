/**
 * 글쓰기에서 코인을 고를 때 옆에 보여 주는 "지금 내 보유" (HODL-106). **참고용**이다 —
 * 글에 붙는 기록은 발행할 때 서버가 지갑 · 거래소를 다시 읽어 정한다.
 *
 * `GET /me/assets` 를 읽는다(최대 15초). 서버가 서비스 코인마다 이렇게 나눠 준다:
 *   - `assets`           확인된 양수 보유(일부 조회 실패여도 확인된 부분합이 양수면 여기)
 *   - `unresolvedAssets` 확인 실패 · 일부만 확인(`UNKNOWN` 또는 `PARTIAL`)
 *   - 둘 다 아니면       연결한 수단을 모두 확인했고 0개
 * 연결한 지갑 · 거래소가 하나도 없으면 전부 "연결 없음"이다.
 *
 * 양수 목록에 없다고 고를 수 없게 하지 않는다 — 미보유 · 미연결도 그대로 붙일 수 있고, 그
 * 상태가 기록된다. 조회 실패를 "0개" 로 말하지 않는 것이 이 파일의 요점이다.
 */

export type HoldingReference =
  | { kind: "holder"; band: string | null; partial: boolean }
  | { kind: "empty" }
  | { kind: "unknown" }
  | { kind: "not-connected" };

export type HoldingsReference = {
  connected: boolean;
  held: Record<string, { band: string | null; partial: boolean }>;
  unresolved: string[];
};

type AssetsResponse = {
  walletCount?: unknown;
  exchangeCount?: unknown;
  assets?: unknown;
  unresolvedAssets?: unknown;
};

type Row = { symbol?: unknown; quantityBand?: unknown; syncStatus?: unknown; quantity?: unknown };

/** 응답 → 참고 정보. 생성 타입의 `assets` 모양이 틀려 있어(백엔드 이름 겹침) 손으로 좁힌다. */
export function toHoldingsReference(response: AssetsResponse): HoldingsReference {
  const count = (value: unknown) => (typeof value === "number" && value > 0 ? value : 0);
  const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : []);

  const held: HoldingsReference["held"] = {};
  for (const row of rows(response.assets)) {
    if (typeof row.symbol !== "string") continue;
    const quantity = Number(row.quantity);
    if (row.quantity !== undefined && !(quantity > 0)) continue;
    held[row.symbol] = {
      band: typeof row.quantityBand === "string" && row.quantityBand ? row.quantityBand : null,
      partial: row.syncStatus === "PARTIAL",
    };
  }

  return {
    connected: count(response.walletCount) + count(response.exchangeCount) > 0,
    held,
    unresolved: rows(response.unresolvedAssets)
      .map((row) => row.symbol)
      .filter((symbol): symbol is string => typeof symbol === "string"),
  };
}

export function referenceOf(reference: HoldingsReference, symbol: string): HoldingReference {
  if (!reference.connected) return { kind: "not-connected" };
  const held = reference.held[symbol];
  // 양수가 확인됐으면 일부 실패여도 보유다(서버의 HOLDER + PARTIAL 과 같다).
  if (held) return { kind: "holder", band: held.band, partial: held.partial };
  if (reference.unresolved.includes(symbol)) return { kind: "unknown" };
  return { kind: "empty" };
}

/** 화면 문구. 지금 잔액이라는 걸 잊지 않게 "지금" 을 붙인다. */
export function referenceLabel(reference: HoldingReference): string {
  switch (reference.kind) {
    case "holder":
      return `지금 ${reference.band ?? "보유"}${reference.partial ? " · 일부만 확인" : ""}`;
    case "empty":
      return "지금 잔액 0";
    case "unknown":
      return "지금 확인 실패";
    case "not-connected":
      return "연결한 지갑 · 거래소 없음";
  }
}
