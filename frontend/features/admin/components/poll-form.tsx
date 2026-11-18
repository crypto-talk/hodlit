"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POLL_MAX, POLL_MIN_CHOICES, pollProblems } from "../limits";
import type { PollInput } from "../types";
import Field from "./field";

type Props = {
  busy: boolean;
  onSubmit: (input: PollInput) => void;
};

const EMPTY: PollInput = { question: "", choices: ["", ""] };

/**
 * 새 투표 폼: 질문 하나 + 선택지 2~10개.
 *
 * 만든 뒤에는 질문 · 선택지를 고칠 수 없다(쌓인 표 아래에서 선택지가 바뀌면 안 된다). 고치려면
 * 새 투표를 만든다. 그래서 수정 폼은 없다.
 */
export default function PollForm({ busy, onSubmit }: Props) {
  const [input, setInput] = useState<PollInput>(EMPTY);
  const [tried, setTried] = useState(false);
  const problems = tried ? pollProblems(input) : {};

  const setChoice = (index: number, value: string) =>
    setInput((now) => ({
      ...now,
      choices: now.choices.map((choice, at) => (at === index ? value : choice)),
    }));

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (Object.keys(pollProblems(input)).length > 0) return;
        onSubmit(input);
      }}
    >
      <Field label="질문" hint="예: 오늘 ETH, 오를까 내릴까?" problem={problems.question}>
        {(props) => (
          <Input
            {...props}
            value={input.question}
            maxLength={POLL_MAX.question}
            onChange={(event) => setInput((now) => ({ ...now, question: event.target.value }))}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs font-semibold text-text-muted">
          선택지 ({input.choices.length}/{POLL_MAX.choices})
        </legend>
        {input.choices.map((choice, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`${index + 1}번 선택지`}
              value={choice}
              maxLength={POLL_MAX.choice}
              onChange={(event) => setChoice(index, event.target.value)}
            />
            <Button
              type="button"
              className="size-10 flex-none px-0 py-0"
              aria-label={`${index + 1}번 선택지 빼기`}
              disabled={input.choices.length <= POLL_MIN_CHOICES}
              onClick={() =>
                setInput((now) => ({
                  ...now,
                  choices: now.choices.filter((_, at) => at !== index),
                }))
              }
            >
              <X />
            </Button>
          </div>
        ))}
        {problems.choices ? (
          <p role="alert" className="text-xs text-danger">
            {problems.choices}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            disabled={input.choices.length >= POLL_MAX.choices}
            onClick={() => setInput((now) => ({ ...now, choices: [...now.choices, ""] }))}
          >
            <Plus />
            선택지 추가
          </Button>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button variant="primary" disabled={busy}>
          {busy ? "만드는 중…" : "투표 만들기"}
        </Button>
      </div>
    </form>
  );
}
