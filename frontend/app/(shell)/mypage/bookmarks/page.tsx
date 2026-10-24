import type { Metadata } from "next";
import MyBookmarks from "@/features/post/components/my-bookmarks";

export const metadata: Metadata = {
  title: "북마크 — Hodlit",
};

/** 마이페이지 북마크 탭. */
export default function MypageBookmarksPage() {
  return <MyBookmarks />;
}
