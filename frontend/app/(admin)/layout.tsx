import type { Metadata } from "next";
import Header from "@/components/layout/header";
import AdminFrame from "@/features/admin/components/admin-frame";

/**
 * 관리자 화면군 `/admin/*`.
 *
 * 헤더만 있고 사이드바(전체 방)는 없다 — 관리 화면 옆에 사용자용 방 목록이 붙으면 어색하다.
 * `(focus)` 는 가운데 정렬된 좁은 폼 화면이라 목록을 담기에 맞지 않아 따로 둔다.
 *
 * 검색엔진에는 올리지 않는다. 막는 것은 어디까지나 백엔드의 403 이다.
 */
export const metadata: Metadata = {
  title: "관리자 — Hodlit",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-[880px] px-6 pt-8 pb-16">
        <AdminFrame>{children}</AdminFrame>
      </main>
    </div>
  );
}
