import type { Metadata } from "next";
import BannerManager from "@/features/admin/components/banner-manager";

export const metadata: Metadata = {
  title: "배너 관리 — Hodlit 관리자",
};

/** 관리자 배너 관리 (HODL-92). */
export default function AdminBannersPage() {
  return <BannerManager />;
}
