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
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { identify, resetIdentity } from "@/lib/analytics/client";
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
 * 세션은 동일 출처 BFF의 HttpOnly 쿠키로 복원한다. 복원 중에는 보호 화면을
 * 비로그인 상태로 확정하지 않으며, 일시적인 실패는 재시도할 수 있다.
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
  const [restoreError, setRestoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const epoch = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const queryClient = useQueryClient();

  const changeMember = useCallback(
    async (next: Member | null, broadcast = false) => {
      epoch.current += 1;
      await queryClient.cancelQueries();
      queryClient.clear();
      setMember(next);
      setRestored(true);
      setRestoreError(false);
      if (broadcast) channel.current?.postMessage("changed");
    },
    [queryClient],
  );

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const events = new BroadcastChannel("hodlit-session");
    channel.current = events;
    events.onmessage = () => {
      epoch.current += 1;
      setMember(null);
      setRestored(false);
      void queryClient.cancelQueries().then(() => {
        queryClient.clear();
        setAttempt((n) => n + 1);
      });
    };
    return () => {
      events.close();
      channel.current = null;
    };
  }, [queryClient]);

  useEffect(() => {
    // One-time migration: never read the previous token into JS state.
    try {
      window.sessionStorage.removeItem("cryptalk_access");
      window.localStorage.removeItem("cryptalk_access");
    } catch {
      // Storage may be disabled; cookie authentication does not depend on it.
    }
    const expired = () => {
      void changeMember(null);
    };
    window.addEventListener("hodlit-session-expired", expired);
    return () => window.removeEventListener("hodlit-session-expired", expired);
  }, [changeMember]);

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

  // 분석용 식별(HODL-89). 서버가 분석 전용 식별자를 줄 때만 잇는다. 없으면 아무 일도 없다.
  const analyticsId = member?.analyticsId ?? null;
  useEffect(() => {
    identify(analyticsId);
  }, [analyticsId]);

  const value = useMemo<SessionValue>(
    () => ({
      member,
      restored,
      login: async (loginId, password) => {
        const next = await api.login(loginId, password);
        await changeMember(next, true);
        return next;
      },
      signup: async (loginId, password, nickname) => {
        const next = await api.signup(loginId, password, nickname);
        await changeMember(next, true);
        return next;
      },
      logout: async () => {
        // Invalidate restoration before awaiting logout. A failed logout stays visible.
        epoch.current += 1;
        await api.logout();
        await changeMember(null, true);
        resetIdentity();
      },
      connectWallet: async () => {
        const started = epoch.current;
        const next = await linkWallet();
        if (epoch.current === started) await changeMember(keepRole(member, next), true);
        return next;
      },
      replaceMember: (next) => setMember((previous) => keepRole(previous, next)),
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
 * 로그인 전이면 `/login?next=<지금 주소>` 로 보내고 `true` 를 돌려준다.
 * 이미 로그인돼 있으면 아무것도 하지 않고 `false` 를 돌려주므로, 부르는 쪽은
 * 그때 자기 안내 문구를 띄우면 된다.
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
