"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/session";
import { checkAdmin } from "../api";
import RoomManager from "./room-manager";
import ModerationPanel from "./moderation-panel";

type Props = { tab: string; q: string; page: number; state: string };

export default function AdminConsole({ tab, q, page, state }: Props) {
  const { member, restored } = useSession();
  const router = useRouter();
  const access = useQuery({
    queryKey: ["admin-access", member?.id],
    queryFn: checkAdmin,
    enabled: restored && !!member,
    retry: false,
  });

  if (!restored) return <p>로그인 상태 확인 중…</p>;
  if (!member) return <Link href="/login?next=%2Fadmin">관리자 로그인</Link>;
  if (access.isPending) return <p>관리자 권한 확인 중…</p>;
  if (access.isError)
    return (
      <div role="alert">
        <p>관리자 권한이 없거나 확인할 수 없습니다.</p>
        <button onClick={() => access.refetch()}>다시 확인</button>
      </div>
    );

  function navigate(nextTab: string, nextQ = "", nextPage = 0, nextState = "") {
    router.push(
      `/admin?${new URLSearchParams({ tab: nextTab, q: nextQ, page: String(nextPage), state: nextState })}`,
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-h1 font-semibold">서비스 관리</h1>
      <nav className="flex flex-wrap gap-4" aria-label="관리 항목">
        {[
          ["rooms", "방·등급 설정"],
          ["posts", "게시글"],
          ["members", "유저"],
          ["logs", "관리 이력"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-current={tab === value ? "page" : undefined}
            className={tab === value ? "font-bold text-brand" : "text-text-muted"}
            onClick={() => navigate(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "rooms" ? (
        <RoomManager
          q={q}
          page={page}
          navigate={(query, nextPage) => navigate(tab, query, nextPage)}
        />
      ) : (
        <ModerationPanel
          key={tab}
          type={tab === "members" ? "members" : tab === "logs" ? "logs" : "posts"}
          q={q}
          page={page}
          state={state}
          navigate={(query, nextPage, filter) => navigate(tab, query, nextPage, filter)}
        />
      )}
    </div>
  );
}
