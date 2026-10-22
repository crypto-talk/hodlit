import type { Metadata } from "next";
import PortfolioView from "@/features/portfolio/components/portfolio-view";

export const metadata: Metadata = {
  title: "내 자산 — Hodlit",
};

/** 마이페이지 내 자산 탭 (HODL-67). */
export default function MypageAssetsPage() {
  return <PortfolioView />;
}
