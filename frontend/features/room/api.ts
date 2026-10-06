import type { SidebarRoom } from "@/components/layout/types";
import type { components } from "@/lib/api-schema";
import { formatChangeRate } from "@/lib/format/number";
import { http } from "@/lib/http";
import { coinNameKo } from "@/lib/coin-name-ko";

/**
 * 방 목록 (구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * 랜딩에 있던 `loadRooms` 를 여기로 옮겼다. 사이드바의 '전체 방'은 랜딩만의
 * 것이 아니라 셸의 것이고, 3단계의 방 게시판·글 상세도 같은 목록을 쓴다.
 *
 * ⚠️ `lib/api-schema.ts` 의 응답 타입은 모든 필드가 선택(`?`)이다. 백엔드가
 * 응답 스키마에 required 를 안 내보내서다. 여기서 한 번 좁히고, 화면은 좁혀진
 * 뷰 모델만 받는다.
 */

type Schemas = components["schemas"];
type CoinResponse = Schemas["CoinResponse"];
type PriceQuote = Schemas["PriceQuote"];

const ROOM_LIMIT = 10;

/**
 * 사이드바 '전체 방'.
 *
 * 등락률은 `GET /market/prices` 에서 온다. 시세 조회가 실패해도 방 목록은
 * 보여야 하므로 등락률만 대시로 떨어뜨린다.
 */
export async function loadRooms(): Promise<SidebarRoom[]> {
  const [coins, prices] = await Promise.all([
    http<CoinResponse[]>("/api/v1/coins"),
    http<PriceQuote[]>("/api/v1/market/prices?currency=KRW").catch(() => [] as PriceQuote[]),
  ]);

  const changeBySymbol = new Map(
    prices.filter(hasSymbol).map((quote) => [quote.symbol, quote.change24h ?? null]),
  );

  return coins
    .filter(hasSymbol)
    .slice(0, ROOM_LIMIT)
    .map((coin) => ({
      symbol: coin.symbol,
      // 백엔드는 영문명만 준다. 한글명 필드가 생기면 coinNameKo 를 지운다(D-4).
      name: coinNameKo(coin.symbol, coin.name ?? coin.symbol),
      change: formatChangeRate(changeBySymbol.get(coin.symbol)),
    }));
}

function hasSymbol<T extends { symbol?: string }>(value: T): value is T & { symbol: string } {
  return typeof value.symbol === "string" && value.symbol.length > 0;
}
