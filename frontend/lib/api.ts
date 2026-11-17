import { ApiError, http, withSessionLock } from "@/lib/http";

/**
 * 구조 개편 전부터 남은 마지막 API 모음. `lib/session.tsx` 만 쓴다 —
 * 로그인 · 회원가입 · 로그아웃 · 세션 복원. 지갑 연결은 `lib/wallet-link.ts` 로 옮겼다(HODL-55).
 *
 * 전송은 `lib/http.ts` 를 거친다. 타입은 손으로 적은 `Member` 하나뿐이다.
 *
 * 새 코드를 여기에 추가하지 않는다. 화면이 쓰는 API 는 `features/<domain>/api.ts` 로
 * 간다. 인증 응답은 BFF가 토큰을 제거한 회원 정보만 포함한다.
 */

export type Member = {
  id: number;
  nickname: string;
  avatarColor: string;
  walletAddress: string | null;
  assetVisibility: string;
};

type AuthResult = { member: Member };

async function authenticate(path: string, body: unknown): Promise<Member> {
  const result = await withSessionLock(() =>
    http<AuthResult>(path, { method: "POST", body: JSON.stringify(body) }),
  );
  return result.member;
}

/** Read the current session; http handles one coordinated refresh on expiry. */
export async function refreshSession(): Promise<Member | null> {
  try {
    return await http<Member>("/api/v1/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export const api = {
  signup: (loginId: string, password: string, nickname: string) =>
    authenticate("/api/v1/auth/signup", { loginId, password, nickname }),

  login: (loginId: string, password: string) =>
    authenticate("/api/v1/auth/login", { loginId, password }),

  logout: () => withSessionLock(() => http<void>("/api/v1/auth/logout", { method: "POST" })),
};
