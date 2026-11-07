import type { Member } from "@/lib/api";
import { http } from "@/lib/http";
import type { ProfileTab } from "@/lib/routes";
import type { PublicProfile, ProfilePage } from "./types";

/**
 * 공개 프로필은 회원 id 로만 찾는다(HODL-103 · 104). 닉네임 조회 API 는 쓰지 않는다 —
 * 닉네임은 바뀌고, 규칙 전에 만든 닉네임엔 주소에 넣기 곤란한 문자가 있을 수 있다.
 */
export const loadProfile = (memberId: number) => http<PublicProfile>(`/api/v1/members/${memberId}`);
/** 작성한 글 · 댓글. `page` 는 화면 쪽 번호(1부터)이고 API 에는 0부터 보낸다. */
export const loadProfileItems = (memberId: number, tab: ProfileTab, page: number) =>
  http<ProfilePage>(`/api/v1/members/${memberId}/${tab}/page?page=${page - 1}&size=20`);

/**
 * 내 닉네임 변경. 서버가 앞뒤 공백을 자르고 규칙 · 중복을 검사한다(400 · 409).
 * 성공하면 내 정보(`/me` 와 같은 모양)를 돌려준다.
 */
export const updateNickname = (nickname: string) =>
  http<Member>("/api/v1/me", { method: "PATCH", body: JSON.stringify({ nickname }) });

export type AssetVisibility = { symbol: string; name: string; visible: boolean };
export const loadAssetVisibility = () => http<AssetVisibility[]>("/api/v1/me/asset-visibility");
export const saveAssetVisibility = (symbol: string, visible: boolean) =>
  http<AssetVisibility>(`/api/v1/me/asset-visibility/${encodeURIComponent(symbol)}`, {
    method: "PUT",
    body: JSON.stringify({ visible }),
  });
