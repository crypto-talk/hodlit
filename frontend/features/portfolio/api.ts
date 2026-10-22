import { coinNameKo } from "@/lib/coin-name-ko";
import { http } from "@/lib/http";
import type { Portfolio, PortfolioSlice, UnpricedHolding, ValuedHolding } from "./types";

/**
 * 내 자산 포트폴리오 (HODL-67, 구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * `GET /me/assets` 하나로 그린다. 서버가 하는 일:
 *   - 연결된 지갑 전부 + 거래소 전부의 잔액을 다시 조회해 서비스 코인별로 합산한다
 *   - 합산 수량 × 원화 시세 = `valueKrw`. 조회가 완전할 때(`syncStatus=READY`)만 준다
 *   - 일부 출처가 실패한 코인은 `unresolvedAssets` 에 따로 알린다
 * 그래서 프론트는 같은 코인을 다시 더하지 않는다. 비중만 계산한다.
 *
 * 서버가 지갑을 Alchemy 로 다시 읽어서 최대 15초 걸린다.
 *
 * ⚠️ 응답 타입을 생성 타입에서 가져오지 않는다. `lib/api-schema.ts` 에서
 * `AssetPortfolioResponse.assets` 가 거래소 잔고용 `AssetResponse` 로 잘못 묶여 있다(백엔드에
 * 같은 이름의 record 가 둘이라 OpenAPI 스키마가 하나로 합쳐졌다). 실제 모양은 백엔드
 * `AssetService.AssetResponse` 다. 돈이 걸린 응답이라 숫자는 여기서 한 번 검사한다(D-4).
 */

type AssetRow = {
  symbol?: unknown;
  quantity?: unknown;
  valueKrw?: unknown;
  syncStatus?: unknown;
  capturedAt?: unknown;
};

type IssueRow = {
  symbol?: unknown;
};

type PortfolioResponse = {
  walletCount?: unknown;
  exchangeCount?: unknown;
  assets?: unknown;
  unresolvedAssets?: unknown;
};

/** 원형 차트에 따로 그리는 코인 수. 넘으면 나머지는 "기타" 한 조각으로 묶는다. */
export const SLICE_LIMIT = 5;

/** 회원 id 가 들어가서 로그아웃 · 다른 계정 로그인 때 이전 자산이 새지 않는다. */
export function portfolioQueryKey(memberId: number | null) {
  return ["portfolio", memberId] as const;
}

export async function loadPortfolio(): Promise<Portfolio> {
  return toPortfolio(await http<PortfolioResponse>("/api/v1/me/assets"));
}

/** 응답 → 뷰 모델. 순수 함수라 유닛 테스트가 여기를 본다. */
export function toPortfolio(response: PortfolioResponse): Portfolio {
  const connected = count(response.walletCount) + count(response.exchangeCount) > 0;
  const rows = Array.isArray(response.assets) ? (response.assets as AssetRow[]) : [];
  const issues = Array.isArray(response.unresolvedAssets)
    ? (response.unresolvedAssets as IssueRow[])
    : [];

  const valued: Omit<ValuedHolding, "share">[] = [];
  const unpriced: UnpricedHolding[] = [];
  let capturedAt: string | null = null;

  for (const row of rows) {
    const symbol = typeof row.symbol === "string" ? row.symbol : null;
    const quantity = amount(row.quantity);
    if (!symbol || quantity === null || quantity <= 0) continue;

    const name = coinNameKo(symbol, symbol);
    const value = amount(row.valueKrw);
    if (value !== null && value > 0) {
      valued.push({ symbol, name, quantity, valueKrw: value });
    } else {
      unpriced.push({
        symbol,
        name,
        quantity,
        reason: row.syncStatus === "PARTIAL" ? "partial" : "price",
      });
    }

    if (typeof row.capturedAt === "string" && (!capturedAt || row.capturedAt > capturedAt)) {
      capturedAt = row.capturedAt;
    }
  }

  const totalKrw = valued.reduce((sum, holding) => sum + holding.valueKrw, 0);
  const holdings: ValuedHolding[] = valued
    .map((holding) => ({ ...holding, share: totalKrw > 0 ? holding.valueKrw / totalKrw : 0 }))
    .sort((a, b) => b.valueKrw - a.valueKrw);

  const incomplete = [
    ...new Set(
      issues.map((issue) => issue.symbol).filter((s): s is string => typeof s === "string"),
    ),
  ];

  return {
    connected,
    totalKrw,
    holdings,
    slices: toSlices(holdings),
    unpriced,
    incomplete,
    capturedAt,
  };
}

/**
 * 상위 `SLICE_LIMIT` 개는 코인마다 한 조각, 나머지는 회색 "기타" 한 조각.
 * 조각이 많으면 원형 차트로는 크기를 비교할 수 없다. 기타에 묶인 코인은 범례 둘째 줄에 적는다.
 */
function toSlices(holdings: ValuedHolding[]): PortfolioSlice[] {
  const head = holdings.length > SLICE_LIMIT ? holdings.slice(0, SLICE_LIMIT) : holdings;
  const rest = holdings.slice(head.length);

  const slices: PortfolioSlice[] = head.map((holding, index) => ({
    key: holding.symbol,
    label: holding.name,
    detail: holding.symbol,
    valueKrw: holding.valueKrw,
    share: holding.share,
    colorSlot: index,
  }));

  if (rest.length > 0) {
    slices.push({
      key: "__other",
      label: "기타",
      detail: rest.map((holding) => holding.symbol).join(" · "),
      valueKrw: rest.reduce((sum, holding) => sum + holding.valueKrw, 0),
      share: rest.reduce((sum, holding) => sum + holding.share, 0),
      colorSlot: null,
    });
  }

  return slices;
}

/** BigDecimal 은 숫자로 오지만, 문자열로 바뀌어도 읽는다. 음수 · NaN · 무한대는 버린다. */
function amount(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
