"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNow } from "@/lib/use-now";
import { DRAW_EVENT_MAX, drawEventProblems } from "../draw-events";
import type { DrawEventInput } from "../types";
import Field from "./field";

const TEXTAREA =
  "min-h-24 w-full rounded-sm border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-subtle focus:border-text-muted aria-invalid:border-danger";

const EMPTY: DrawEventInput = { title: "", description: "", startsAt: "", endsAt: "" };

type Props = {
  /** 고칠 때는 지금 값, 새로 만들 때는 없다. */
  initial?: DrawEventInput;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: DrawEventInput) => void;
  /** 없으면 취소 버튼을 그리지 않는다(아코디언 안의 수정 폼). */
  onCancel?: () => void;
};

/**
 * 뽑기 이벤트 기본 정보 폼 — 제목 · 설명 · 시작 · 종료 (HODL-94).
 *
 * - 시각은 **한국 시간으로 입력받는다.** 브라우저 시간대가 달라도 입력칸의 숫자는 한국 시간이고,
 *   보낼 때 UTC 로 바꾼다(`kstInputToUtc`). 입력칸 옆에 "한국 시간" 을 적어 둔다
 * - 시작은 지금보다 뒤여야 한다. 처음 여는 것도 시작 전에만 되므로, 여유 있게 잡으라고 안내한다
 * - 검사는 한 번 저장을 눌러 본 뒤부터 칸마다 보인다(다른 관리자 폼과 같다)
 */
export default function DrawEventForm({ initial, submitLabel, busy, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState<DrawEventInput>(initial ?? EMPTY);
  const [tried, setTried] = useState(false);
  // 시작 시각 검사에 쓴다. 렌더 중 Date.now() 를 부르지 않으려고 훅으로 받는다.
  const now = useNow();
  const problems = tried ? drawEventProblems(input, now) : {};
  const set = (patch: Partial<DrawEventInput>) => setInput((value) => ({ ...value, ...patch }));
  const dirty =
    !initial ||
    input.title !== initial.title ||
    input.description !== initial.description ||
    input.startsAt !== initial.startsAt ||
    input.endsAt !== initial.endsAt;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        // 누른 순간의 시각으로 다시 본다. 화면의 `now` 는 30초마다만 바뀐다.
        if (Object.keys(drawEventProblems(input, Date.now())).length > 0) return;
        onSubmit(input);
      }}
    >
      <Field label="제목" hint="참여 화면 맨 위에 보입니다." problem={problems.title}>
        {(props) => (
          <Input
            {...props}
            value={input.title}
            maxLength={DRAW_EVENT_MAX.title}
            onChange={(event) => set({ title: event.target.value })}
          />
        )}
      </Field>

      <Field
        label="설명 (선택)"
        hint="참여 화면 제목 아래에 줄바꿈 그대로 보입니다."
        problem={problems.description}
      >
        {(props) => (
          <textarea
            {...props}
            className={TEXTAREA}
            value={input.description}
            maxLength={DRAW_EVENT_MAX.description}
            onChange={(event) => set({ description: event.target.value })}
          />
        )}
      </Field>

      <div className="grid gap-4 min-[600px]:grid-cols-2">
        <Field label="시작 (한국 시간)" problem={problems.startsAt}>
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={input.startsAt}
              onChange={(event) => set({ startsAt: event.target.value })}
            />
          )}
        </Field>
        <Field label="종료 (한국 시간)" problem={problems.endsAt}>
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={input.endsAt}
              onChange={(event) => set({ endsAt: event.target.value })}
            />
          )}
        </Field>
      </div>
      <p className="-mt-2 text-xs text-text-subtle">
        시작은 지금보다 뒤여야 하고, 이벤트는 시작 시각 전에 열어야 합니다. 상품을 넣고 열 시간을
        생각해 여유 있게 잡아 주세요.
      </p>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" onClick={onCancel} disabled={busy}>
            취소
          </Button>
        ) : null}
        <Button variant="primary" disabled={busy || !dirty}>
          {busy ? "저장 중…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
