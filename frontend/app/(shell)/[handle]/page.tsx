import { notFound } from "next/navigation";
import PublicProfileView from "@/features/profile/components/public-profile";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle: routeHandle } = await params;
  // Next 16 passes this dynamic segment URI-encoded (including the leading @).
  let handle: string;
  try {
    handle = routeHandle.startsWith("@") ? routeHandle : decodeURIComponent(routeHandle);
  } catch {
    notFound();
  }
  if (!handle.startsWith("@") || handle.length < 2) notFound();
  const query = await searchParams;
  return (
    <PublicProfileView
      nickname={handle.slice(1)}
      tab={query.tab === "comments" ? "comments" : "posts"}
      page={
        Number.isSafeInteger(Number(query.page)) && Number(query.page) >= 0 ? Number(query.page) : 0
      }
    />
  );
}
