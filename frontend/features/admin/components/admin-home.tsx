import { DoorOpen, Megaphone, Vote, FileText, Users, History } from "lucide-react";
import Link from "next/link";
import { adminRoomsHref } from "@/lib/routes";

/**
 * 통계 자리. 관리자용 통계 API 가 아직 없어서 칸만 잡아 둔다. 어떤 숫자를 둘지는 정해지면
 * 여기 줄을 바꾼다.
 */
const STAT_SLOTS = ["회원", "글", "댓글", "인증 회원"] as const;

type Menu = {
  label: string;
  description: string;
  icon: typeof DoorOpen;
  /** 없으면 준비 중이다. */
  href?: string;
};

const MENUS: Menu[] = [
  {
    label: "방 관리",
    description: "방 · 카테고리 · 등급 설정",
    icon: DoorOpen,
    href: adminRoomsHref(),
  },
  {
    label: "게시글 관리",
    description: "글 조회 · 숨김 · 복구",
    icon: FileText,
    href: "/admin/posts",
  },
  {
    label: "유저 관리",
    description: "계정 조회 · 정지 · 해제",
    icon: Users,
    href: "/admin/members",
  },
  { label: "관리 이력", description: "서비스 관리 조치 기록", icon: History, href: "/admin/logs" },
  { label: "뉴스 관리", description: "방 뉴스 등록 · 수정", icon: Megaphone },
  { label: "투표 관리", description: "방 일일 투표 준비", icon: Vote },
];

/** 관리자 메인. 위에 통계, 아래에 관리 메뉴. */
export default function AdminHome() {
  return (
    <>
      <section aria-labelledby="admin-stats-title" className="flex flex-col gap-3">
        <h2 id="admin-stats-title" className="text-h2 font-semibold">
          통계
        </h2>
        <ul className="grid grid-cols-2 gap-3 min-[600px]:grid-cols-4">
          {STAT_SLOTS.map((label) => (
            <li
              key={label}
              className="rounded-lg border border-dashed border-border-subtle bg-surface px-4 py-5"
            >
              <p className="text-sm text-text-muted">{label}</p>
              <p className="mt-2 text-sm text-text-subtle">통계 준비 중</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-menu-title" className="flex flex-col gap-3">
        <h2 id="admin-menu-title" className="text-h2 font-semibold">
          관리
        </h2>
        <ul className="grid gap-3 min-[600px]:grid-cols-3">
          {MENUS.map((menu) => (
            <li key={menu.label}>
              {menu.href ? (
                <Link
                  href={menu.href}
                  className="flex h-full items-start gap-3 rounded-lg border border-border-subtle bg-surface p-4 hover:border-text-muted"
                >
                  <MenuBody menu={menu} />
                </Link>
              ) : (
                <div
                  aria-disabled="true"
                  className="flex h-full items-start gap-3 rounded-lg border border-border-subtle bg-surface-muted p-4 text-text-muted"
                >
                  <MenuBody menu={menu} soon />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function MenuBody({ menu, soon = false }: { menu: Menu; soon?: boolean }) {
  const Icon = menu.icon;
  return (
    <>
      <Icon aria-hidden className="mt-0.5 size-5 flex-none" />
      <span>
        <span className="block font-semibold">
          {menu.label}
          {soon ? <span className="ml-2 text-xs font-normal">준비 중</span> : null}
        </span>
        <span className="mt-0.5 block text-sm text-text-muted">{menu.description}</span>
      </span>
    </>
  );
}
