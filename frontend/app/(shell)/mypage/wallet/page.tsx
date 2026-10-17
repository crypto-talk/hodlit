import type { Metadata } from "next";
import WalletManager from "@/features/wallet/components/wallet-manager";

export const metadata: Metadata = {
  title: "지갑 관리 — Hodlit",
};

/** 마이페이지 지갑 탭 (HODL-74). */
export default function MypageWalletPage() {
  return <WalletManager />;
}
