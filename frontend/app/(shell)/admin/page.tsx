import AdminConsole from "@/features/admin/components/admin-console";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const tab =
    typeof query.tab === "string" && ["rooms", "posts", "members", "logs"].includes(query.tab)
      ? query.tab
      : "rooms";
  const candidate = Number(query.page);
  const page = Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : 0;
  return (
    <AdminConsole
      tab={tab}
      q={typeof query.q === "string" ? query.q : ""}
      page={page}
      state={typeof query.state === "string" ? query.state : ""}
    />
  );
}
