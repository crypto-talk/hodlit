"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, refreshSession, type Member } from "@/lib/api";
import { linkWallet } from "@/lib/wallet-link";

/**
 * 로그인 상태.
 *
 * 랜딩 한 화면일 때는 `app/page.tsx` 의 `useState` 하나로 충분했다. 셸이
 * 레이아웃으로 올라가면서 헤더(로그아웃)와 페이지(투표·글쓰기)가 같은 상태를
 * 봐야 하므로 컨텍스트로 뺀다.
 *
 * `features/auth/` 가 아니라 `lib/` 에 있는 이유: 헤더가 `components/layout/` 에
 * 있고 거기서는 `features/` 를 참조할 수 없다(구조 규칙 1).
 *
 * ⚠️ access 토큰이 아직 sessionStorage 라 서버 컴포넌트는 로그인 상태를 그릴 수
 * 없다. 그래서 복원은 마운트 후 `refresh` 쿠키로만 일어난다. access 가 httpOnly
 * 쿠키로 옮겨지면(B-3) 이 파일부터 고친다.
 */

type SessionValue = {
  member: Member | null;
  /** 첫 세션 복원이 끝났는지. 끝나기 전에는 로그인/비로그인 UI를 확정하지 않는다. */
  restored: boolean;
  login: (loginId: string, password: string) => Promise<Member>;
  signup: (loginId: string, password: string, nickname: string) => Promise<Member>;
  logout: () => Promise<void>;
  /**
   * 지갑 연결. AppKit 모달에서 확장 지갑이나 QR · 모바일 지갑을 고른다.
   * 성공하면 member 가 새 객체로 바뀐다.
   */
  connectWallet: () => Promise<Member>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let alive = true;
    refreshSession()
      .then((next) => {
        if (alive) setMember(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setRestored(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      member,
      restored,
      login: async (loginId, password) => {
        const next = await api.login(loginId, password);
        setMember(next);
        return next;
      },
      signup: async (loginId, password, nickname) => {
        const next = await api.signup(loginId, password, nickname);
        setMember(next);
        return next;
      },
      logout: async () => {
        await api.logout().catch(() => undefined);
        setMember(null);
      },
      connectWallet: async () => {
        const next = await linkWallet();
        setMember(next);
        return next;
      },
    }),
    [member, restored],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession 은 SessionProvider 안에서만 쓸 수 있습니다.");
  return value;
}

/**
 * 로그인이 필요한 동작 앞에 부른다.
 *
 * 로그인 전이면 `/login?next=<지금 주소>` 로 보내고 `true` 를 돌려준다.
 * 이미 로그인돼 있으면 아무것도 하지 않고 `false` 를 돌려주므로, 부르는 쪽은
 * 그때 자기 안내 문구를 띄우면 된다.
 */
export function useRequireLogin(): () => boolean {
  const { member } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(() => {
    if (member) return false;
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return true;
  }, [member, pathname, router]);
}
