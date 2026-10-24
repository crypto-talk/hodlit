import type { Metadata } from "next";
import MyDrafts from "@/features/post/components/my-drafts";

export const metadata: Metadata = {
  title: "임시저장 — Hodlit",
};

/** 마이페이지 임시저장 탭. 새 글 · 글 수정(HODL-56) 임시저장을 함께 보인다. */
export default function MypageDraftsPage() {
  return <MyDrafts />;
}
