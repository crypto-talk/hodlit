import type { SidebarRoom } from "@/components/layout/types";
import type { components } from "@/lib/api-schema";
import { isVerifiable } from "@/lib/holder-snapshot/label";
import { http } from "@/lib/http";
import { coinNameKo } from "@/lib/coin-name-ko";
import { hasPostId, toPostSummary } from "@/lib/post-summary";
import { isOpenRoom, type WithOperationStatus } from "@/lib/room-status";
import type { RoomInfo, RoomPostPage } from "./types";

/**
 * 방 목록과 방 게시판 (구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * 랜딩에 있던 `loadRooms` 를 여기로 옮겼다. 사이드바의 '전체 방'은 랜딩만의
 * 것이 아니라 셸의 것이고, 3단계의 방 게시판·글 상세도 같은 목록을 쓴다.
 *
 * ⚠️ `lib/api-schema.ts` 의 응답 타입은 모든 필드가 선택(`?`)이다. 백엔드가
 * 응답 스키마에 required 를 안 내보내서다. 여기서 한 번 좁히고, 화면은 좁혀진
 * 뷰 모델만 받는다.
 *
 * 방 시세는 여기서 가져오지 않는다. 브라우저가 CoinGecko 를 직접 부르고(HODL-61), 랜딩 티커와
 * 같은 요청을 나눠 쓰므로 `lib/market-price/` 에 있다.
 */

type Schemas = components["schemas"];
// `operationStatus` 는 생성 타입에 아직 없다(HODL-77). 다시 생성하면 덧붙인 부분을 지운다.
type CoinResponse = Schemas["CoinResponse"] & WithOperationStatus;
type CommunityResponse = Schemas["CommunityResponse"];
type PostPageResponse = Schemas["PageResponsePostResponse"];

const ROOM_LIMIT = 10;

/** 방 게시판 한 쪽에 보여주는 글 수. 백엔드 번호 페이지의 기본값과 같다. */
export const ROOM_PAGE_SIZE = 20;

/**
 * 사이드바 '전체 방'. 닫힌 방(HODL-77)은 빼고 열린 방만.
 *
 * 등락률은 뺐다(HODL-59). 그래서 시세를 같이 부르지 않는다.
 * 닫힌 방 안내의 "열린 방" 링크도 이 목록을 쓴다.
 */
export async function loadRooms(): Promise<SidebarRoom[]> {
  const coins = await http<CoinResponse[]>("/api/v1/coins");

  return coins
    .filter(hasSymbol)
    .filter(isOpenRoom)
    .slice(0, ROOM_LIMIT)
    .map((coin) => ({
      symbol: coin.symbol,
      // 백엔드는 영문명만 준다. 한글명 필드가 생기면 coinNameKo 를 지운다(D-4).
      name: coinNameKo(coin.symbol, coin.name ?? coin.symbol),
    }));
}

/**
 * 방 머리. 없는 방이면 404 이고, 화면은 `ApiError.status` 로 구분한다.
 * 닫힌 방도 200 으로 오고(`postCount` 는 0), `closed` 로 알린다.
 */
export async function loadRoom(symbol: string): Promise<RoomInfo> {
  const community = await http<CommunityResponse>(
    `/api/v1/communities/${encodeURIComponent(symbol)}`,
  );
  // 방 머리의 코인에도 `operationStatus` 가 실린다. 생성 타입에 없어 넓혀 읽는다.
  const coin = community.coin as CoinResponse | undefined;
  const resolved = coin?.symbol ?? symbol;
  const postCount = community.postCount ?? 0;

  return {
    symbol: resolved,
    name: coinNameKo(resolved, coin?.name ?? resolved),
    description: community.description ?? "",
    postCount,
    verifiable: isVerifiable(coin?.verificationAvailability),
    accentColor: coin?.accentColor || null,
    closed: coin ? !isOpenRoom(coin) : false,
  };
}

/**
 * 방 글 목록 한 쪽 (HODL-66, `docs/NUMBERED_PAGINATION_API.md`).
 *
 * `page` 는 화면 기준 1부터다. API 는 0부터라 여기서 하나 뺀다.
 * 인증 탭은 서버가 거른다(`verified=true`). 서버 기준은 발행 때 보유자로 확인된 글
 * (`authorVerified`)이라, 미보유 · 미인증 글은 인증 탭에 나오지 않는다.
 * 범위를 넘는 쪽은 에러가 아니라 빈 목록과 실제 총수가 온다.
 */
export async function loadRoomPostPage(
  symbol: string,
  tab: "all" | "verified",
  page: number,
): Promise<RoomPostPage> {
  const query = new URLSearchParams({
    page: String(Math.max(0, page - 1)),
    size: String(ROOM_PAGE_SIZE),
  });
  if (tab === "verified") query.set("verified", "true");

  const result = await http<PostPageResponse>(
    `/api/v1/communities/${encodeURIComponent(symbol)}/posts/page?${query}`,
  );

  return {
    posts: (result.items ?? []).filter(hasPostId).map(toPostSummary),
    totalPages: result.totalPages ?? 0,
    totalPosts: result.totalElements ?? 0,
  };
}

function hasSymbol<T extends { symbol?: string }>(value: T): value is T & { symbol: string } {
  return typeof value.symbol === "string" && value.symbol.length > 0;
}
