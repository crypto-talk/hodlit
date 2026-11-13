import type { components } from "@/lib/api-schema";
import { http } from "@/lib/http";
import { imageSrc } from "@/lib/media";
import { safeLink } from "@/lib/safe-url";
import type { Banner } from "./types";

/**
 * 사용자 화면 배너 (HODL-92, `docs/ASSIGNED_FEATURES_API.md`). 구조 규칙 2: 데이터 진입점은 여기 하나.
 *
 * `GET /api/v1/banners` 는 공개 API 다. 노출 중인 배너만 순서대로 온다 — 숨긴 배너는 응답에 없으므로
 * 프론트가 다시 거를 것이 없다. 서버가 응답을 따로 쥐고 있지 않아 관리자가 저장하면 다음 조회에
 * 바로 반영된다.
 */

type PublicBanner = components["schemas"]["PublicBanner"];

export const BANNERS_QUERY_KEY = ["banners"] as const;

export async function loadBanners(): Promise<Banner[]> {
  const result = await http<PublicBanner[]>("/api/v1/banners");
  return [...result]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0))
    .flatMap(toBanner);
}

/**
 * 응답을 화면 모양으로. 이미지 주소를 쓸 수 없으면 그 배너는 버린다. 링크가 쓸 수 없는 모양이면
 * 배너는 그리되 링크만 뺀다 — 서버도 같은 규칙으로 저장하지만 href 에 넣기 전에 한 번 더 본다.
 */
export function toBanner(raw: PublicBanner): Banner[] {
  const src = imageSrc(raw.imageUrl);
  if (raw.id === undefined || !src) return [];
  return [{ id: raw.id, src, altText: raw.altText ?? "", link: safeLink(raw.linkUrl) }];
}
