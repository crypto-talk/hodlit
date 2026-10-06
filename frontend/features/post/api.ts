import type { components } from "@/lib/api-schema";
import { coinNameKo } from "@/lib/coin-name-ko";
import { http } from "@/lib/http";
import type { PostDraft, PublishedPost, WriteRoom } from "./types";

/**
 * 글 (구조 규칙 2: 데이터 진입점은 여기 하나).
 *
 * ⚠️ `lib/api-schema.ts` 의 응답 타입은 모든 필드가 선택(`?`)이다. 백엔드가
 * 응답 스키마에 required 를 안 내보내서다. 여기서 한 번 좁히고, 화면은 좁혀진
 * 뷰 모델만 받는다.
 */

type Schemas = components["schemas"];
type CoinResponse = Schemas["CoinResponse"];
type PostResponse = Schemas["PostResponse"];
type CreatePostRequest = Schemas["CreatePostRequest"];

/**
 * 글을 쓸 수 있는 방 목록.
 *
 * 사이드바의 방 목록(`features/room`)은 10개로 자르고 시세까지 붙인다. 여기는
 * 고를 수 있는 방이 전부 필요하고 시세는 필요 없어서 따로 부른다.
 */
export async function loadWriteRooms(): Promise<WriteRoom[]> {
  const coins = await http<CoinResponse[]>("/api/v1/coins");

  return coins.filter(hasSymbol).map((coin) => ({
    symbol: coin.symbol,
    name: coinNameKo(coin.symbol, coin.name ?? coin.symbol),
  }));
}

/**
 * 발행.
 *
 * 보내지 않는 것
 *   - `assetPrice` · `assetPriceCurrency`: 서버가 무시하고 직접 시세를 조회한다.
 *   - 보유 정보: 서버가 발행 순간 연결된 지갑으로 스냅샷을 찍는다. 프론트가
 *     보내는 값은 없다. 그래서 배지를 위조할 길도 없다.
 *
 * 제목·본문은 앞뒤 공백을 잘라 보낸다. 백엔드가 `@NotBlank` 로 거르는 기준과
 * 맞춘 것이다.
 */
export async function publishPost(draft: PostDraft): Promise<PublishedPost> {
  const body: CreatePostRequest = {
    coinSymbol: draft.coinSymbol,
    title: draft.title.trim(),
    content: draft.content.trim(),
  };

  const post = await http<PostResponse>("/api/v1/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (typeof post?.id !== "number") {
    throw new Error("발행은 됐지만 응답에 글 번호가 없습니다.");
  }

  return { id: post.id, coinSymbol: post.coinSymbol ?? draft.coinSymbol };
}

function hasSymbol<T extends { symbol?: string }>(value: T): value is T & { symbol: string } {
  return typeof value.symbol === "string" && value.symbol.length > 0;
}
