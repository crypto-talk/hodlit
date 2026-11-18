import type { Metadata } from "next";
import MyVotes from "@/features/vote/components/my-votes";
import { parsePage } from "@/lib/routes";

export const metadata: Metadata = {
  title: "내 투표",
};

/** 마이페이지 내 투표 탭 (HODL-109). 쪽은 `?page=2`. */
export default async function MypageVotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return <MyVotes page={parsePage(page)} />;
}
