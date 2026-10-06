import type { SidebarRoom } from "@/components/layout/types";
import type { components } from "@/lib/api-schema";
import { formatChangeRate } from "@/lib/format/number";
import { isVerifiable } from "@/lib/holder-snapshot/label";
import { http } from "@/lib/http";
import { coinNameKo } from "@/lib/coin-name-ko";
import { type PostSummary, hasPostId, toPostSummary } from "@/lib/post-summary";
import type { RoomInfo, RoomPrice } from "./types";

/**
 * 방 목록과 방 게시판 (구조 규칙 2: 데이터 진입점은 여기 하나).
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
type CommunityResponse = Schemas["CommunityResponse"];
type PostResponse = Schemas["PostResponse"];
type PriceQuote = Schemas["PriceQuote"];

const ROOM_LIMIT = 10;

/**
 * 방 게시판에 한 번에 받는 글 수.
 *
 * ⚠️ `/communities/{symbol}/posts` 에 커서가 없다. `size` 만 받아 최신순 배열을
 * 돌려주므로 "그다음 N개"를 달라고 할 방법이 없다. 그래서 더보기 없이 최신
 * N개만 보여준다. 백엔드 상한이 100 이다. 커서가 생기면 피드형으로 바꾼다.
 */
export const ROOM_POST_LIMIT = 50;

/** 백엔드가 방 글 수를 셀 때 쓰는 상한. 이 값이면 "이상"으로 읽는다. */
const POST_COUNT_CAP = 100;

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

/**
 * 방 머리. 없는 방이면 404 이고, 화면은 `ApiError.status` 로 구분한다.
 */
export async function loadRoom(symbol: string): Promise<RoomInfo> {
  const community = await http<CommunityResponse>(
    `/api/v1/communities/${encodeURIComponent(symbol)}`,
  );
  const coin = community.coin;
  const resolved = coin?.symbol ?? symbol;
  const postCount = community.postCount ?? 0;

  return {
    symbol: resolved,
    name: coinNameKo(resolved, coin?.name ?? resolved),
    description: community.description ?? "",
    postCount,
    // 백엔드가 최신 100개만 세서 100 에서 멈춘다. 진짜 총수가 아니다.
    postCountCapped: postCount >= POST_COUNT_CAP,
    verifiable: isVerifiable(coin?.verificationAvailability),
    accentColor: coin?.accentColor || null,
  };
}

/**
 * 방 시세. 응답에 가격이 없으면 null 이다. 요청 실패는 화면이 시세 칸 안에서만
 * 처리한다 — 시세가 안 와도 게시판은 읽을 수 있어야 한다.
 *
 * 과거 시세 API 가 없어서 차트는 그리지 않는다. 현재가와 24시간 등락률만이다.
 */
export async function loadRoomPrice(symbol: string): Promise<RoomPrice | null> {
  const quote = await http<PriceQuote>(
    `/api/v1/market/prices/${encodeURIComponent(symbol)}?currency=KRW`,
  );
  if (typeof quote?.price !== "number" || !Number.isFinite(quote.price)) return null;

  const change = quote.change24h;
  const direction =
    typeof change !== "number" || Math.round(change * 10) === 0
      ? "flat"
      : change > 0
        ? "up"
        : "down";

  return {
    price: quote.price,
    change: formatChangeRate(change),
    direction,
    capturedAt: quote.capturedAt ?? "",
  };
}

/** 방 글 목록. 최신순 `ROOM_POST_LIMIT` 개. */
export async function loadRoomPosts(symbol: string): Promise<PostSummary[]> {
  const posts = await http<PostResponse[]>(
    `/api/v1/communities/${encodeURIComponent(symbol)}/posts?size=${ROOM_POST_LIMIT}`,
  );
  return (posts ?? []).filter(hasPostId).map(toPostSummary);
}

function hasSymbol<T extends { symbol?: string }>(value: T): value is T & { symbol: string } {
  return typeof value.symbol === "string" && value.symbol.length > 0;
}
