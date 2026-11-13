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
  /**
   * 서버가 돌려준 내 정보로 바꾼다. 닉네임 변경(`PATCH /me`) 뒤 헤더 · 마이페이지에
   * 새 닉네임이 바로 보이게 한다. 다른 회원으로 바꾸는 용도가 아니다.
   */
  replaceMember: (next: Member) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * 같은 회원의 정보를 새 응답으로 바꿀 때, 새 응답에 role 이 빠져 있으면 알던 값을 잇는다.
 * 지갑 연결 · 닉네임 변경 응답이 role 을 안 줘도 관리자 메뉴가 사라지지 않게 하려는 것이다.
 * 다른 회원이면 잇지 않는다 — 이전 계정의 권한 표시가 남으면 안 된다(HODL-108).
 */
function keepRole(previous: Member | null, next: Member): Member {
  if (next.role || !previous || previous.id !== next.id) return next;
  return { ...next, role: previous.role };
}

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
        setMember((previous) => keepRole(previous, next));
        return next;
      },
      replaceMember: (next) => setMember((previous) => keepRole(previous, next)),
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
