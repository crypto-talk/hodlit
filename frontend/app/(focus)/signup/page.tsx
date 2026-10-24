import type { Metadata } from "next";
import AuthForm from "@/features/auth/components/auth-form";
import { safeNext } from "@/features/auth/safe-next";

export const metadata: Metadata = {
  title: "시작하기 — Hodlit",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" next={safeNext(next)} />;
}
