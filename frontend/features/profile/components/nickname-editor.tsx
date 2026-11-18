"use client";

import { FormEvent, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NICKNAME_HINT,
  NICKNAME_MAX,
  nicknameAwareMessage,
  nicknameProblem,
  normalizeNickname,
} from "@/lib/nickname";
import { useSession } from "@/lib/session";
import { updateNickname } from "../api";

/**
 * 마이페이지 위쪽의 닉네임 변경 (HODL-104).
 *
 * 평소엔 "닉네임 변경" 버튼만 있고, 누르면 그 자리에 입력칸이 열린다. 보내기 전에 서버와
 * 같은 규칙(`lib/nickname.ts`)으로 먼저 검사하고, 서버의 400 · 409 도 같은 문구로 보여 준다.
 * 공개 프로필 주소는 회원 id 라 닉네임을 바꿔도 그대로다.
 *
 * 규칙 전에 만든 닉네임(공백 · `@` 등)은 그대로 쓸 수 있고, 바꿀 때만 새 규칙을 따른다.
 */
export default function NicknameEditor() {
  const { member, replaceMember } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const hintId = useId();
  const errorId = useId();

  if (!member) return null;

  const start = () => {
    setValue(member.nickname);
    setError("");
    setOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nickname = normalizeNickname(value);
    if (nickname === member.nickname) {
      setOpen(false);
      return;
    }
    const problem = nicknameProblem(nickname);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setPending(true);
    try {
      const next = await updateNickname(nickname);
      replaceMember(next);
      // 내 공개 프로필 머리의 닉네임. 글 · 댓글 목록은 다시 받을 때 서버가 새 닉네임으로 준다.
      void queryClient.invalidateQueries({ queryKey: ["public-profile", next.id] });
      toast.success("닉네임을 바꿨습니다.");
      setOpen(false);
    } catch (reason) {
      setError(
        nicknameAwareMessage(reason, "닉네임을 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요."),
      );
    } finally {
      setPending(false);
    }
  };

  if (!open)
    return (
      <button type="button" onClick={start} className="text-sm text-brand hover:underline">
        닉네임 변경
      </button>
    );

  return (
    // 링크 줄(flex-wrap) 안에서 다음 줄로 내려가도록 바깥은 한 줄을 다 차지하고, 폼만 폭을 줄인다.
    <div className="order-last mt-2 basis-full">
      <form onSubmit={submit} className="flex max-w-md flex-col gap-1.5" noValidate>
        <label htmlFor={`${hintId}-input`} className="text-sm font-semibold text-text-primary">
          새 닉네임
        </label>
        <div className="flex gap-2">
          <Input
            id={`${hintId}-input`}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError("");
            }}
            maxLength={NICKNAME_MAX}
            autoComplete="off"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
          <Button type="button" onClick={() => setOpen(false)} disabled={pending}>
            취소
          </Button>
        </div>
        <p id={hintId} className="text-xs text-text-muted">
          {NICKNAME_HINT}. 바꿔도 프로필 주소는 그대로입니다.
        </p>
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
