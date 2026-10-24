import type { Metadata } from "next";
import AuthForm from "@/features/auth/components/auth-form";
import { safeNext } from "@/features/auth/safe-next";

export const metadata: Metadata = {
  title: "로그인 — Hodlit",
};

/**
 * `?next=` 는 서버에서 읽는다.
 *
 * 클라이언트에서 `useSearchParams()` 로 읽으면 정적 렌더가 막혀 `<Suspense>`
 * 경계를 따로 둬야 한다. 페이지가 값을 꺼내 프롭으로 내리면 그게 없어도 된다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={safeNext(next)} />;
}
