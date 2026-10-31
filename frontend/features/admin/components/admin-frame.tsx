"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ApiError } from "@/lib/http";
import { ADMIN_HREF } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { checkAdminAccess } from "../api";

/**
 * 관리자 화면 틀: 로그인 확인 → 관리자 확인 → 제목.
 *
 * 관리자 확인은 관리자 API 를 한 번 불러 본 응답으로 한다. 프론트가 받는 응답에 아직 role 이
 * 없어서다(HODL-88). role 이 생겨도 이 확인은 남긴다 — 프론트의 값은 사용자가 바꿀 수 있어서
 * 권한의 근거가 될 수 없고, role 은 헤더에 관리자 메뉴를 보일지 정하는 데만 쓴다.
 *
 * 로그인 확인은 마이페이지처럼 세션 복원이 끝난 뒤에만 한다.
 */
export default function AdminFrame({ children }: { children: React.ReactNode }) {
  const { member, restored } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const loggedOut = restored && !member;
  useEffect(() => {
    if (loggedOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loggedOut, pathname, router]);

  const access = useQuery({
    // 회원이 바뀌면 다시 확인한다. 로그아웃 후 다른 계정으로 들어온 경우.
    queryKey: ["admin", "access", member?.id],
    queryFn: checkAdminAccess,
    enabled: Boolean(member),
    retry: false,
  });

  // 확인 중에 토큰이 만료되어 갱신까지 실패한 경우. 로그인 화면으로 보낸다.
  const expired = access.error instanceof ApiError && access.error.status === 401;
  useEffect(() => {
    if (expired) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [expired, pathname, router]);

  if (!member || expired) {
    return <Notice>{loggedOut || expired ? "로그인 화면으로 이동합니다…" : "불러오는 중…"}</Notice>;
  }

  if (access.isPending) return <Notice>권한을 확인하는 중…</Notice>;

  if (access.isError) {
    const forbidden = access.error instanceof ApiError && access.error.status === 403;
    return forbidden ? (
      <Notice title="관리자만 볼 수 있는 화면입니다">
        관리자 권한이 필요하면 운영진에게 문의해 주세요.{" "}
        <Link href="/" className="text-brand hover:underline">
          홈으로
        </Link>
      </Notice>
    ) : (
      <Notice title="권한을 확인하지 못했습니다">
        잠시 후 다시 시도해 주세요.{" "}
        <button
          type="button"
          className="text-brand hover:underline"
          onClick={() => void access.refetch()}
        >
          다시 시도
        </button>
      </Notice>
    );
  }

  const atHome = pathname === ADMIN_HREF;

  return (
    <div className="flex flex-col gap-8">
      <div>
        {atHome ? null : (
          <Link href={ADMIN_HREF} className="text-sm text-text-muted hover:text-text-primary">
            ← 관리자 홈
          </Link>
        )}
        <h1 className="mt-1 text-h1 font-bold">관리자</h1>
        <p className="mt-1 text-sm text-text-muted">{member.nickname} · 서비스 관리자</p>
      </div>
      {children}
    </div>
  );
}

function Notice({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="py-16 text-center">
      {title ? <h1 className="text-h2 font-semibold text-text-primary">{title}</h1> : null}
      <p className="mt-2 text-sm text-text-muted">{children}</p>
    </div>
  );
}
