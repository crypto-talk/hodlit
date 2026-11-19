import type { Metadata } from "next";
import PollManager from "@/features/admin/components/poll-manager";
import { adminRoomParam } from "@/lib/routes";
import { parsePollNumber } from "@/features/admin/poll-deletion";

export const metadata: Metadata = {
  title: "투표 관리",
};

/** 관리자 방 투표 관리 (HODL-111). `?room=ETH` 고른 방. 모양이 아닌 값은 무시한다. */
export default async function AdminPollsPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; poll?: string }>;
}) {
  const { room, poll } = await searchParams;
  const symbol = adminRoomParam(room);
  return <PollManager key={symbol} room={symbol} pollId={parsePollNumber(poll)} />;
}
