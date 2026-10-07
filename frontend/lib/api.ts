import { clearAccessToken, setAccessToken } from "@/lib/auth-token";
import { http } from "@/lib/http";

/**
 * 구조 개편 전부터 남은 마지막 API 모음. `lib/session.tsx` 만 쓴다 —
 * 로그인 · 회원가입 · 로그아웃 · 세션 복원 · 지갑 연결.
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
};

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

type InjectedProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

async function injectedWallet() {
  const ethereum = (window as typeof window & { ethereum?: InjectedProvider }).ethereum;
  if (!ethereum) throw new Error("EVM 지갑 확장 프로그램을 설치해 주세요.");

  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  const walletAddress = accounts[0];
  if (!walletAddress) throw new Error("지갑 계정을 선택해 주세요.");

  return { ethereum, walletAddress };
}

export async function linkInjectedWallet(): Promise<Member> {
  const { ethereum, walletAddress } = await injectedWallet();

  const nonce = await http<{ nonceId: string; message: string }>("/api/v1/me/wallet/nonce", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });

  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [nonce.message, walletAddress],
  })) as string;

  return http<Member>("/api/v1/me/wallet", {
    method: "POST",
    body: JSON.stringify({ walletAddress, nonceId: nonce.nonceId, signature }),
  });
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
