import type { Metadata } from "next";
import PollManager from "@/features/admin/components/poll-manager";
import { adminRoomParam } from "@/lib/routes";

export const metadata: Metadata = {
  title: "투표 관리",
};

/** 관리자 방 투표 관리 (HODL-111). `?room=ETH` 고른 방. 모양이 아닌 값은 무시한다. */
export default async function AdminPollsPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const { room } = await searchParams;
  return <PollManager room={adminRoomParam(room)} />;
}
