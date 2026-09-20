"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";

export type AuthMode = "login" | "signup";

type Props = {
  mode: AuthMode;
  /** 성공 후 돌아갈 경로. 페이지가 `?next=` 를 검사해서 넘겨준다. */
  next: string;
};

/**
 * 로그인 · 회원가입 폼.
 *
 * 모달(`AuthDialog`)이었던 것을 `/login?next=` 와 `/signup` 두 페이지의 본문으로
 * 바꿨다(A-5). 모드 전환은 탭이 아니라 링크다. 주소가 상태를 들고 있어야
 * 뒤로가기와 북마크가 동작하고, 로그인이 필요한 동작에서 그냥 보내면 된다.
 *
 * 인증 호출은 `lib/session.tsx` 가 한다. 여기서 직접 api 를 부르면 성공한 뒤
 * 헤더가 여전히 로그아웃 상태로 남는다.
 */
export default function AuthForm({ mode, next }: Props) {
  const { login, signup } = useSession();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const loginId = String(form.get("loginId") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      if (mode === "signup") {
        await signup(loginId, password, String(form.get("nickname") ?? ""));
      } else {
        await login(loginId, password);
      }
      // 뒤로가기로 로그인 화면에 되돌아오지 않도록 replace 를 쓴다.
      router.replace(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "인증에 실패했습니다.");
      setPending(false);
    }
  };

  const otherHref =
    mode === "login"
      ? `/signup?next=${encodeURIComponent(next)}`
      : `/login?next=${encodeURIComponent(next)}`;

  return (
    <section className="hd-auth-card">
      <h1 className="text-h2 font-semibold">{mode === "signup" ? "시작하기" : "로그인"}</h1>
      <p className="text-sm text-text-muted" style={{ marginTop: 8 }}>
        연결 안 해도 읽고 쓸 수 있습니다. 지갑은 나중에 붙여도 됩니다.
      </p>

      <form className="hd-form" onSubmit={submit}>
        {mode === "signup" ? (
          <input
            ref={firstFieldRef}
            className="hd-field"
            name="nickname"
            aria-label="닉네임"
            placeholder="닉네임"
            minLength={2}
            maxLength={40}
            required
          />
        ) : null}
        {/* 백엔드 계약이 email → loginId 로 바뀌었다. type 도 text 다. */}
        <input
          ref={mode === "login" ? firstFieldRef : undefined}
          className="hd-field"
          name="loginId"
          type="text"
          aria-label="아이디"
          placeholder="아이디"
          autoComplete="username"
          required
        />
        <input
          className="hd-field"
          name="password"
          type="password"
          aria-label="비밀번호"
          placeholder="비밀번호 (8자 이상)"
          minLength={8}
          maxLength={72}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
        />
        <Button type="submit" variant="primary" className="mt-2 w-full" disabled={pending}>
          {pending ? "확인 중…" : mode === "signup" ? "계정 만들기" : "로그인"}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="hd-error">
          {error}
        </p>
      ) : null}

      <div className="hd-auth-foot">
        <Link href={otherHref} className="text-sm font-semibold text-brand">
          {mode === "login" ? "계정 만들기" : "이미 계정이 있어요"}
        </Link>
        <Link href={next} className="text-sm text-text-muted">
          돌아가기
        </Link>
      </div>
    </section>
  );
}
