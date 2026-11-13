import { clearAccessToken, setAccessToken } from "@/lib/auth-token";
import { http } from "@/lib/http";

/**
 * 구조 개편 전부터 남은 마지막 API 모음. `lib/session.tsx` 만 쓴다 —
 * 로그인 · 회원가입 · 로그아웃 · 세션 복원. 지갑 연결은 `lib/wallet-link.ts` 로 옮겼다(HODL-55).
 *
 * 전송은 `lib/http.ts` 를 거친다. 타입은 손으로 적은 `Member` 하나뿐이다.
 *
 * 새 코드를 여기에 추가하지 않는다. 화면이 쓰는 API 는 `features/<domain>/api.ts` 로
 * 간다. access 토큰이 쿠키로 옮겨질 때(B-3) 세션 코드와 함께 정리한다.
 */

export type Member = {
  id: number;
  nickname: string;
  avatarColor: string;
  walletAddress: string | null;
  assetVisibility: string;
  /**
   * 본인 응답에만 오는 역할(HODL-88). 관리자 메뉴를 보일지 정하는 데만 쓴다 — 관리자 화면에
   * 들어갈 수 있는지는 관리자 API 의 403 이 정한다. 값이 없는 옛 응답은 일반 회원으로 본다.
   */
  role?: "USER" | "ADMIN";
};

/** 관리자 메뉴를 보여도 되는 회원인지. 로그인 전 · 세션 복원 중(null)이면 false 다. */
export function isAdminMember(member: Member | null): boolean {
  return member?.role === "ADMIN";
}

type AuthResult = { accessToken: string; member: Member };

async function authenticate(path: string, body: unknown): Promise<Member> {
  const result = await http<AuthResult>(path, { method: "POST", body: JSON.stringify(body) });
  setAccessToken(result.accessToken);
  return result.member;
}

/**
 * refresh 쿠키로 세션을 복원한다. 실패는 "로그인 안 된 상태"라 오류가 아니므로
 * null 을 돌려준다.
 */
export async function refreshSession(): Promise<Member | null> {
  try {
    return await authenticate("/api/v1/auth/refresh", undefined);
  } catch {
    clearAccessToken();
    return null;
  }
}

export const api = {
  signup: (loginId: string, password: string, nickname: string) =>
    authenticate("/api/v1/auth/signup", { loginId, password, nickname }),

  login: (loginId: string, password: string) =>
    authenticate("/api/v1/auth/login", { loginId, password }),

  logout: async () => {
    try {
      await http<void>("/api/v1/auth/logout", { method: "POST" });
    } finally {
      clearAccessToken();
    }
  },
};
