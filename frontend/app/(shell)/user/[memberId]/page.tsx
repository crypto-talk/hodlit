import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicProfileView from "@/features/profile/components/public-profile";
import { config } from "@/lib/config";
import { parseMemberId } from "@/lib/routes";

type Params = Promise<{ memberId: string }>;
type SearchParams = Promise<{ tab?: string | string[]; page?: string | string[] }>;

const FALLBACK_TITLE = "프로필 — Hodlit";

/**
 * 탭 제목 "닉네임 — Hodlit". 공개 API 라 서버에서 바로 부른다(토큰 필요 없음).
 * 실패하거나 2초 안에 안 오면 기본 제목 — 제목 때문에 화면이 늦거나 깨지지 않게 한다.
 * 본문은 클라이언트가 따로 받는다(로그인 회원과 같은지 봐야 해서).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const memberId = parseMemberId((await params).memberId);
  if (memberId === null) return { title: FALLBACK_TITLE };
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/members/${memberId}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return { title: FALLBACK_TITLE };
    const { nickname } = (await response.json()) as { nickname?: unknown };
    return {
      title: typeof nickname === "string" && nickname ? `${nickname} — Hodlit` : FALLBACK_TITLE,
    };
  } catch {
    return { title: FALLBACK_TITLE };
  }
}

/**
 * 공개 프로필 `/user/{회원 id}` (HODL-104).
 *
 * id 가 1 이상의 정수가 아니면 요청 없이 404. 없는 회원은 화면 안에서 "찾을 수 없습니다".
 * 쪽은 1부터, 숫자가 아니거나 1보다 작으면 1쪽이다.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const memberId = parseMemberId((await params).memberId);
  if (memberId === null) notFound();

  const query = await searchParams;
  const page = Number.parseInt(first(query.page), 10);
  return (
    <PublicProfileView
      memberId={memberId}
      tab={first(query.tab) === "comments" ? "comments" : "posts"}
      page={Number.isSafeInteger(page) && page >= 1 ? page : 1}
    />
  );
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
