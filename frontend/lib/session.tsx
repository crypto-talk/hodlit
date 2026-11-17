"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, refreshSession, type Member } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
 * 없다. 복원은 마운트 후 저장된 access와 필요 시 refresh 쿠키를 사용한다. access 가 httpOnly
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
  const [restoreError, setRestoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const epoch = useRef(0);

  useEffect(() => {
    const expired = () => {
      epoch.current += 1;
      setMember(null);
      setRestored(true);
      setRestoreError(false);
    };
    window.addEventListener("hodlit-session-expired", expired);
    return () => window.removeEventListener("hodlit-session-expired", expired);
  }, []);

  useEffect(() => {
    let alive = true;
    const started = epoch.current;
    refreshSession()
      .then((next) => {
        if (!alive || epoch.current !== started) return;
        setMember(next);
        setRestored(true);
        setRestoreError(false);
      })
      .catch(() => {
        if (alive && epoch.current === started) setRestoreError(true);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const changeMember = useCallback((next: Member | null) => {
    epoch.current += 1;
    setMember(next);
    setRestored(true);
    setRestoreError(false);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      member,
      restored,
      login: async (loginId, password) => {
        const next = await api.login(loginId, password);
        changeMember(next);
        return next;
      },
      signup: async (loginId, password, nickname) => {
        const next = await api.signup(loginId, password, nickname);
        changeMember(next);
        return next;
      },
      logout: async () => {
        epoch.current += 1;
        await api.logout().catch(() => undefined);
        changeMember(null);
      },
      connectWallet: async () => {
        const next = await linkWallet();
        changeMember(next);
        return next;
      },
    }),
    [member, restored, changeMember],
  );

  return (
    <SessionContext.Provider value={value}>
      {restoreError && (
        <div role="alert" className="flex items-center gap-3 bg-surface px-6 py-3 text-sm">
          로그인 상태를 확인하지 못했습니다.
          <Button
            type="button"
            onClick={() => {
              setRestoreError(false);
              setAttempt((n) => n + 1);
            }}
          >
            다시 시도
          </Button>
        </div>
      )}
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession 은 SessionProvider 안에서만 쓸 수 있습니다.");
  return value;
}

/**
 * 로그인이 필요한 동작 앞에 부른다.
 *
 * 복원 중이면 이동 없이 동작을 보류하고 `true`를 돌려준다.
 * 복원 후 비로그인이면 `/login?next=<지금 주소>`로 보내고 `true`를 돌려준다.
 * 로그인 상태이면 `false`를 돌려주므로 호출부가 동작을 계속할 수 있다.
 */
export function useRequireLogin(): () => boolean {
  const { member, restored } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(() => {
    if (member) return false;
    if (!restored) return true;
    router.push(`/login?next=${encodeURIComponent(pathname)}`);
    return true;
  }, [member, restored, pathname, router]);
}
