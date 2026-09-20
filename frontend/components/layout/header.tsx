"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <header className="hd-header">
      <Link href="/" className="hd-brand" aria-label="Hodlit 홈">
        <Logo size={32} background="var(--brand)" foreground="var(--text-inverse)" />
        <span className="hd-brand-name">Hodlit</span>
      </Link>

      <button type="button" className="hd-search" disabled title="검색은 준비 중입니다">
        <span className="hd-search-icon" />
        <span className="hd-ellipsis">코인 · 지갑 · 글 검색</span>
      </button>

      <div className="hd-header-actions">
        {member ? (
          <>
            <span className="hd-nick hd-ellipsis">{member.nickname}</span>
            <button
              type="button"
              className="hd-btn hd-btn-primary hd-only-desktop"
              disabled
              title="글쓰기 화면은 아직 준비 중입니다"
            >
              글쓰기
            </button>
            <button type="button" className="hd-btn" onClick={logout}>
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link href={loginHref} className="hd-btn">
              로그인
            </Link>
            <button
              type="button"
              className="hd-btn hd-btn-primary hd-only-desktop"
              disabled
              title="글쓰기 화면은 아직 준비 중입니다"
            >
              글쓰기
            </button>
            <Link href="/signup" className="hd-btn">
              시작하기
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
