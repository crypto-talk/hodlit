import type { components } from "@/lib/api-schema";
import { coinNameKo } from "@/lib/coin-name-ko";
import { config } from "@/lib/config";
import { holdingPeriodLabel, isVerifiable, tierOf } from "@/lib/holder-snapshot/label";
import { refreshHoldings } from "@/lib/holdings-refresh";
import { http } from "@/lib/http";
import type {
  BookmarkedPost,
  EditablePost,
  PostDetail,
  PostEdit,
  PostDraft,
  PostReactions,
  PublishedPost,
  UploadedImage,
  WriteRoom,
} from "./types";

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
type UpdatePostRequest = Schemas["UpdatePostRequest"];
type StoredMedia = Schemas["StoredMedia"];

const MEDIA_PREFIX = "/api/v1/media/";

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
    verifiable: isVerifiable(coin.verificationAvailability),
    name: coinNameKo(coin.symbol, coin.name ?? coin.symbol),
  }));
}

/**
 * 발행.
 *
 * 보내지 않는 것
 *   - `assetPrice` · `assetPriceCurrency`: 서버가 무시하고 직접 시세를 조회한다.
 *   - 보유 정보: 서버가 저장해 둔 보유 기록을 글에 복사한다. 프론트가 보내는
 *     값은 없어서 수량을 위조할 수는 없다. 다만 기록이 오래됐을 수 있어서 발행
 *     직전에 `refreshHoldings()` 로 갱신한다(`lib/holdings-refresh.ts` 참고).
 *
 * 제목·본문은 앞뒤 공백을 잘라 보낸다. 백엔드가 `@NotBlank` 로 거르는 기준과
 * 맞춘 것이다.
 */
export async function publishPost(draft: PostDraft): Promise<PublishedPost> {
  if (draft.verifiable) await refreshHoldings();

  const youtubeUrl = draft.youtubeUrl.trim();
  const body: CreatePostRequest = {
    coinSymbol: draft.coinSymbol,
    title: draft.title.trim(),
    content: draft.content.trim(),
    media: draft.images.map((image) => ({ type: "IMAGE", url: image.url })),
    ...(youtubeUrl ? { youtubeUrl } : {}),
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

/**
 * 이미지 한 장 업로드. 발행 전에 먼저 올려 두고, 발행할 때 url 만 보낸다.
 *
 * 올렸지만 발행하지 않은 파일은 서버에 남는다. 지울 때는 `discardImage` 를 부르고,
 * 창을 닫아 버린 경우는 서버가 정리해야 한다(백엔드 논의 항목).
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append("file", file);

  const stored = await http<StoredMedia>("/api/v1/media", { method: "POST", body: form });

  if (!stored?.url?.startsWith(MEDIA_PREFIX)) {
    throw new Error("업로드는 됐지만 응답에 파일 주소가 없습니다.");
  }
  return { url: stored.url };
}

/**
 * 발행 전에 뺀 이미지를 서버에서도 지운다.
 *
 * 실패해도 글쓰기를 막을 이유가 없어서 에러를 삼킨다. 서버에 파일 하나가
 * 남을 뿐이고, 글에 묶이지 않은 파일은 다른 글에도 쓸 수 없다.
 */
export async function discardImage(image: UploadedImage): Promise<void> {
  const fileName = image.url.slice(MEDIA_PREFIX.length);
  await http<void>(`${MEDIA_PREFIX}${encodeURIComponent(fileName)}`, { method: "DELETE" }).catch(
    () => undefined,
  );
}

/** 백엔드가 주는 상대 경로를 화면에서 열 수 있는 주소로 바꾼다. */
function mediaSrc(url: string): string {
  return url.startsWith("/") ? `${config.apiUrl}${url}` : url;
}

/**
 * 글 상세. 공개 API 라 로그인 없이도 열린다.
 *
 * 404 는 `ApiError.status` 로 화면이 구분한다.
 */
export async function loadPost(postId: number): Promise<PostDetail> {
  const post = await http<PostResponse>(`/api/v1/posts/${postId}`);

  const createdAt = post.createdAt ?? "";
  const price = post.priceSnapshot;
  const snapshot = post.holderSnapshot;

  return {
    id: post.id ?? postId,
    coinSymbol: post.coinSymbol ?? "",
    title: post.title ?? "(제목 없음)",
    content: post.content ?? "",
    authorId: post.author?.id ?? null,
    authorNickname: post.author?.nickname ?? "알 수 없음",
    createdAt,
    // 서버는 발행 때도 updatedAt 을 채운다. 몇 초 차이는 수정으로 보지 않는다.
    edited:
      !!post.updatedAt &&
      !!createdAt &&
      new Date(post.updatedAt).getTime() - new Date(createdAt).getTime() > 60_000,
    images: (post.media ?? [])
      .filter((media) => media.type === "IMAGE" && media.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((media) => ({ id: String(media.id ?? media.url), src: mediaSrc(media.url ?? "") })),
    youtubeVideoId: post.youtube?.videoId ?? null,
    price:
      typeof price?.price === "number" && price.currency
        ? { value: price.price, currency: price.currency }
        : null,
    ...toReactions(post),
    comments: post.comments ?? 0,
    holder: snapshot
      ? {
          verifiable: isVerifiable(snapshot.verificationAvailability),
          tier: tierOf(snapshot.verificationLevel, snapshot.verifiedHolder, snapshot.walletCount),
          // 서버가 완성해서 주는 문자열이다. 여기서 다시 계산하지 않는다.
          amount: snapshot.quantityBand ?? null,
          holding: holdingPeriodLabel(snapshot.holdingMonths),
        }
      : null,
  };
}

/**
 * 수정 화면에 채울 원래 값. 상세와 같은 `GET /posts/{id}` 다.
 *
 * 작성자가 아니어도 받아지지만, 저장은 서버가 403 으로 막는다.
 */
export async function loadEditablePost(postId: number): Promise<EditablePost> {
  const post = await http<PostResponse>(`/api/v1/posts/${postId}`);
  const tradingView = post.tradingView;

  return {
    id: post.id ?? postId,
    coinSymbol: post.coinSymbol ?? "",
    title: post.title ?? "",
    content: post.content ?? "",
    authorId: post.author?.id ?? null,
    images: (post.media ?? [])
      .filter((media) => media.type === "IMAGE" && media.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((media) => ({ url: media.url ?? "", src: mediaSrc(media.url ?? "") })),
    youtubeUrl: post.youtube?.url ?? "",
    tradingView: tradingView?.symbol
      ? {
          symbol: tradingView.symbol,
          interval: tradingView.interval,
          analysis: tradingView.analysis,
        }
      : null,
  };
}

/**
 * 글 수정 (`PUT`). 제목 · 본문 · 이미지 · 유튜브만 바뀐다.
 *
 * 방 · 보유 정보 · 작성 시점 가격은 서버가 건드리지 않는다. 이미지는 보낸 목록으로
 * 통째로 바뀌고, 빠진 기존 이미지는 서버가 저장이 끝난 뒤 지운다. 그래서 수정
 * 화면에서 기존 이미지를 빼도 저장 전에는 서버에서 지우지 않는다.
 *
 * PUT 은 빠진 필드를 null 로 덮는다. 화면에 없는 TradingView 값도 받은 그대로 보낸다.
 */
export async function updatePost(edit: PostEdit): Promise<void> {
  const youtubeUrl = edit.youtubeUrl.trim();
  const body: UpdatePostRequest = {
    title: edit.title.trim(),
    content: edit.content.trim(),
    media: edit.images.map((image) => ({ type: "IMAGE", url: image.url })),
    ...(youtubeUrl ? { youtubeUrl } : {}),
    ...(edit.tradingView
      ? {
          tradingViewSymbol: edit.tradingView.symbol,
          tradingViewInterval: edit.tradingView.interval,
          tradingViewAnalysis: edit.tradingView.analysis,
        }
      : {}),
  };

  await http<PostResponse>(`/api/v1/posts/${edit.id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** 글 삭제. 붙은 이미지 파일은 서버가 커밋 뒤에 지운다(`PostService.delete`). */
export async function deletePost(postId: number): Promise<void> {
  await http<void>(`/api/v1/posts/${postId}`, { method: "DELETE" });
}

/**
 * 좋아요 켜기 · 끄기. 서버는 이미 켜진 걸 또 켜도, 꺼진 걸 또 꺼도 오류 없이 지금
 * 상태를 돌려준다. 그래서 두 번 눌려도 숫자가 어긋나지 않는다.
 */
export async function setLiked(postId: number, on: boolean): Promise<PostReactions> {
  const post = await http<PostResponse>(`/api/v1/posts/${postId}/likes`, {
    method: on ? "POST" : "DELETE",
  });
  return toReactions(post);
}

/** 북마크 켜기 · 끄기. 좋아요와 같은 규칙이다. */
export async function setBookmarked(postId: number, on: boolean): Promise<PostReactions> {
  const post = await http<PostResponse>(`/api/v1/posts/${postId}/bookmarks`, {
    method: on ? "POST" : "DELETE",
  });
  return toReactions(post);
}

/**
 * 내가 북마크한 글. 북마크한 시각 최근 순이다. 페이지가 없어 한 번에 전부 온다.
 *
 * 마이페이지가 생기기 전까지 오른쪽 칸의 임시 목록이 쓴다.
 */
export async function loadBookmarks(): Promise<BookmarkedPost[]> {
  const posts = await http<PostResponse[]>("/api/v1/me/bookmarks");

  return posts
    .filter((post): post is PostResponse & { id: number } => typeof post.id === "number")
    .map((post) => ({
      id: post.id,
      coinSymbol: post.coinSymbol ?? "",
      title: post.title ?? "(제목 없음)",
      createdAt: post.createdAt ?? "",
    }));
}

function toReactions(post: PostResponse): PostReactions {
  return {
    likes: post.likes ?? 0,
    liked: post.liked ?? false,
    bookmarked: post.bookmarked ?? false,
  };
}

function hasSymbol<T extends { symbol?: string }>(value: T): value is T & { symbol: string } {
  return typeof value.symbol === "string" && value.symbol.length > 0;
}
