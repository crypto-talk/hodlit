import { notFound } from "next/navigation";
import ModerationScreen from "@/features/admin/components/moderation-screen";

export default async function AdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  if (section !== "posts" && section !== "members" && section !== "logs") notFound();
  const query = await searchParams;
  const candidate = Number(query.page);
  const page = Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : 0;
  return (
    <ModerationScreen
      type={section}
      q={typeof query.q === "string" ? query.q : ""}
      state={typeof query.state === "string" ? query.state : ""}
      page={page}
    />
  );
}
