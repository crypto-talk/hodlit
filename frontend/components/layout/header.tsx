"use client";

import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MYPAGE_HREF, roomSymbolOf, searchHref, writeHref } from "@/lib/routes";
import { useSession } from "@/lib/session";
import Logo from "./logo";

/**
 * 모든 화면 위에 오는 헤더.
 *
 * 프롭이 없다. (shell) 과 (focus) 두 레이아웃이 각각 이걸 렌더하는데, 둘 다
 * 서버 컴포넌트라 함수 프롭을 내려보낼 수 없다. 로그인 상태는 `useSession()`
 * 에서 직접 읽는다.
 *
 * 검색칸은 Enter 로 `/search?q=` 결과 화면에 보낸다(HODL-65). 방 게시판 · 글 상세 안에서 찾으면
 * 그 방 범위(`&room=ETH`, HODL-69)로 열리고, 결과 화면에서 전체로 넓힐 수 있다.
 * 보낸 뒤에는 비운다 — 검색어를 고치는 곳은 결과 화면 위의 검색칸이다.
 * (지금 주소의 `q` 를 여기서 읽으려면 `useSearchParams` 가 필요한데, 모든 화면의 헤더라 정적
 * 화면까지 클라이언트 렌더로 바뀌어서 쓰지 않는다)
 */
export default function Header() {
  const { member, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  // 로그인 후 원래 보던 화면으로 돌려보낸다. 로그인·회원가입 화면에서는
  // 자기 자신으로 돌아오지 않도록 홈을 넣는다.
  const next = pathname === "/login" || pathname === "/signup" ? "/" : pathname;
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  // 방 게시판·글 상세에서 누르면 그 방이 미리 골라진다.
  const room = roomSymbolOf(pathname);
  const write = writeHref(room);

  function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    // 빈 검색어는 보내지 않는다. 너무 긴 검색어는 결과 화면이 안내한다.
    if (!q) return;
    router.push(searchHref(q, { room }));
    setQuery("");
  }

  return (
    <header className="flex items-center gap-4 border-b border-border-subtle bg-surface px-6 py-4">
      <Link
        href="/"
        className="flex flex-none items-center gap-2 text-text-primary"
        aria-label="Hodlit 홈"
      >
        <Logo size={32} background="var(--brand)" foreground="var(--text-inverse)" />
        {/* 좁은 화면에서는 검색칸 자리를 위해 글자를 빼고 로고만 둔다(이름은 aria-label 에 있다) */}
        <span className="text-h2 font-semibold tracking-[-0.01em] max-shell:hidden">Hodlit</span>
      </Link>

      <form role="search" onSubmit={search} className="flex h-9 min-w-0 flex-1">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-border-subtle bg-canvas px-3 text-sm text-text-muted focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-brand">
          <Search aria-hidden className="size-4 flex-none" strokeWidth={2} />
          <input
            type="search"
            enterKeyHint="search"
            aria-label={room ? `${room} 방에서 검색` : "검색"}
            className="min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-muted"
            placeholder={room ? `${room} 방에서 검색` : "글 · 댓글 · 방 · 닉네임 검색"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </form>

      <div className="flex flex-none items-center gap-2">
        {member ? (
          <>
            {/* 마이페이지 입구. 좁은 화면에서는 사이드바가 숨어서 여기가 유일한 길이다. */}
            <Link
              href={MYPAGE_HREF}
              title="마이페이지"
              className="max-w-35 truncate text-sm font-semibold text-text-primary hover:text-brand"
            >
              {member.nickname}
            </Link>
            <WriteButton href={write} />
            <Button type="button" onClick={logout}>
              로그아웃
            </Button>
          </>
        ) : (
          <>
            <Button asChild>
              <Link href={loginHref}>로그인</Link>
            </Button>
            <WriteButton href={write} />
            <Button asChild>
              <Link href="/signup">회원가입</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

/**
 * 좁은 화면에서는 FAB 이 같은 자리를 맡으므로 숨긴다.
 *
 * 로그인 전이어도 링크는 그대로 둔다. `/write` 가 로그인 화면으로 보내고,
 * 로그인 뒤에는 `?next=` 로 글쓰기에 돌아온다.
 */
function WriteButton({ href }: { href: string }) {
  return (
    <Button asChild variant="primary" className="max-shell:hidden">
      <Link href={href}>글쓰기</Link>
    </Button>
  );
}
