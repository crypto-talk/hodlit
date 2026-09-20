"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import Logo from "./logo";

/**
 * 모든 화면 위에 오는 헤더.
 *
 * 프롭이 없다. (shell) 과 (focus) 두 레이아웃이 각각 이걸 렌더하는데, 둘 다
 * 서버 컴포넌트라 함수 프롭을 내려보낼 수 없다. 로그인 상태는 `useSession()`
 * 에서 직접 읽는다.
 *
 * 글쓰기는 화면 자체가 3단계라 아직 비활성이다. 검색도 백엔드에 `/search` 가
 * 없어 같은 상태다. 눌리는데 아무 일도 안 나는 것보다 눌리지 않는 편이 낫다.
 */
export default function Header() {
  const { member, logout } = useSession();
  const pathname = usePathname();

  // 로그인 후 원래 보던 화면으로 돌려보낸다. 로그인·회원가입 화면에서는
  // 자기 자신으로 돌아오지 않도록 홈을 넣는다.
  const next = pathname === "/login" || pathname === "/signup" ? "/" : pathname;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;

  return (
    <header className="flex items-center gap-4 border-b border-border-subtle bg-surface px-6 py-4">
      <Link
        href="/"
        className="flex flex-none items-center gap-2 text-text-primary"
        aria-label="Hodlit 홈"
      >
        <Logo size={32} background="var(--brand)" foreground="var(--text-inverse)" />
        <span className="text-h2 font-semibold tracking-[-0.01em]">Hodlit</span>
      </Link>

      <button
        type="button"
        className="flex h-9 min-w-0 flex-1 cursor-not-allowed items-center gap-2 rounded-sm border border-border-subtle bg-canvas px-4 text-left text-sm text-text-muted"
        disabled
        title="검색은 준비 중입니다"
      >
        <span className="size-3 flex-none rounded-full border-2 border-text-muted" />
        <span className="truncate">코인 · 지갑 · 글 검색</span>
      </button>

      <div className="flex flex-none items-center gap-2">
        {member ? (
          <>
            <span className="max-w-35 truncate text-sm font-semibold text-text-primary">
              {member.nickname}
            </span>
            <WriteButton />
            <Button type="button" onClick={logout}>
              로그아웃
            </Button>
          </>
        ) : (
          <>
            <Button asChild>
              <Link href={loginHref}>로그인</Link>
            </Button>
            <WriteButton />
            <Button asChild>
              <Link href="/signup">시작하기</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

/** 좁은 화면에서는 FAB 이 같은 자리를 맡으므로 숨긴다. */
function WriteButton() {
  return (
    <Button
      type="button"
      variant="primary"
      className="max-shell:hidden"
      disabled
      title="글쓰기 화면은 아직 준비 중입니다"
    >
      글쓰기
    </Button>
  );
}
