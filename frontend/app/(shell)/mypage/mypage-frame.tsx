"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  MYPAGE_ASSETS_HREF,
  MYPAGE_BOOKMARKS_HREF,
  MYPAGE_DRAFTS_HREF,
  MYPAGE_WALLET_HREF,
} from "@/lib/routes";
import { useSession } from "@/lib/session";

/** 마이페이지 탭. 탭이 늘면 여기에 줄을 더한다. */
const TABS = [
  { href: MYPAGE_WALLET_HREF, label: "지갑" },
  { href: MYPAGE_ASSETS_HREF, label: "내 자산" },
  { href: MYPAGE_BOOKMARKS_HREF, label: "북마크" },
  { href: MYPAGE_DRAFTS_HREF, label: "임시저장" },
] as const;

const TAB_CLASS =
  "border-b-2 border-transparent py-2 text-body font-semibold text-text-muted hover:text-text-primary";
const TAB_ACTIVE = "border-b-brand text-text-primary";

/**
 * 마이페이지 틀: 로그인 확인 + 제목 + 탭.
 *
 * 로그인 확인은 세션 복원(`refresh` 쿠키)이 끝난 뒤에만 한다. 끝나기 전에 보내면 로그인한
 * 사람도 로그인 화면을 한 번 거친다. 로그인 전이면 돌아올 주소를 `?next=` 에 싣는다.
 *
 * 데이터는 모두 `/me/...` 라 토큰 주인 것만 온다. 이 확인은 화면을 그릴지 정하는 용도다.
 */
export default function MypageFrame({ children }: { children: React.ReactNode }) {
  const { member, restored } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const loggedOut = restored && !member;
  useEffect(() => {
    if (loggedOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loggedOut, pathname, router]);

  if (!member) {
    return (
      <p className="text-sm text-text-muted">
        {loggedOut ? "로그인 화면으로 이동합니다…" : "불러오는 중…"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-bold">마이페이지</h1>
        <Link href={`/@${encodeURIComponent(member.nickname)}`} className="text-sm text-brand">
          내 공개 프로필
        </Link>
        <Link href="/admin" className="ml-4 text-sm text-brand">
          서비스 관리
        </Link>
        <p className="mt-1 text-sm text-text-muted">{member.nickname} · 나만 보는 화면입니다</p>
      </div>

      <nav aria-label="마이페이지 탭" className="flex gap-6 border-b border-border-subtle">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={pathname === tab.href ? "page" : undefined}
            className={`${TAB_CLASS} ${pathname === tab.href ? TAB_ACTIVE : ""}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
