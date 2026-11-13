import type { Metadata } from "next";
import DrawManager from "@/features/admin/components/draw-manager";
import { parsePage } from "@/lib/routes";

export const metadata: Metadata = {
  title: "뽑기 관리 — Hodlit 관리자",
};

/** 관리자 뽑기 이벤트 관리 (HODL-94 · 96). `?page=` 는 1부터, 모양이 아니면 1쪽. */
export default async function AdminDrawsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <DrawManager page={parsePage(page)} />;
}
