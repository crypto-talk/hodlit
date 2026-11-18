"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NEWS_MAX, newsProblems } from "../limits";
import type { NewsInput } from "../types";
import Field from "./field";

type Props = {
  /** 고칠 때는 지금 값, 새로 등록할 때는 없다. */
  initial?: NewsInput;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: NewsInput) => void;
  onCancel?: () => void;
};

const EMPTY: NewsInput = { title: "", summary: "", sourceName: "", sourceUrl: "" };

const TEXTAREA =
  "min-h-24 w-full rounded-sm border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-subtle focus:border-text-muted aria-invalid:border-danger";

/**
 * 뉴스 등록 · 수정 폼. 제목 · 요약 · 출처 · 원문 링크 네 칸이고 전부 평문이다.
 *
 * 요약은 직접 쓴 짧은 글이어야 한다 — 서비스는 기사 본문을 가져오지도 옮기지도 않는다
 * (`docs/COMMUNITY_NEWS_API.md` 의 권리 검토). 그래서 칸 아래에 그 말을 적어 둔다.
 * 문제는 처음부터 빨갛게 띄우지 않고, 한 번 보내려 한 뒤부터 칸마다 보인다.
 */
export default function NewsForm({ initial, submitLabel, busy, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState<NewsInput>(initial ?? EMPTY);
  const [tried, setTried] = useState(false);
  const problems = tried ? newsProblems(input) : {};
  const set = (patch: Partial<NewsInput>) => setInput((now) => ({ ...now, ...patch }));

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (Object.keys(newsProblems(input)).length > 0) return;
        onSubmit(input);
      }}
    >
      <Field label="제목" problem={problems.title}>
        {(props) => (
          <Input
            {...props}
            value={input.title}
            maxLength={NEWS_MAX.title}
            onChange={(event) => set({ title: event.target.value })}
          />
        )}
      </Field>
      <Field
        label="요약"
        hint="기사 본문을 옮기지 말고 직접 쓴 짧은 요약을 적습니다."
        problem={problems.summary}
      >
        {(props) => (
          <textarea
            {...props}
            className={TEXTAREA}
            value={input.summary}
            maxLength={NEWS_MAX.summary}
            onChange={(event) => set({ summary: event.target.value })}
          />
        )}
      </Field>
      <div className="grid gap-4 min-[700px]:grid-cols-[1fr_2fr]">
        <Field label="출처" hint="언론사 · 매체 이름" problem={problems.sourceName}>
          {(props) => (
            <Input
              {...props}
              value={input.sourceName}
              maxLength={NEWS_MAX.sourceName}
              onChange={(event) => set({ sourceName: event.target.value })}
            />
          )}
        </Field>
        <Field label="원문 링크" hint="https:// 로 시작하는 기사 주소" problem={problems.sourceUrl}>
          {(props) => (
            <Input
              {...props}
              type="url"
              inputMode="url"
              value={input.sourceUrl}
              maxLength={NEWS_MAX.sourceUrl}
              onChange={(event) => set({ sourceUrl: event.target.value })}
            />
          )}
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" onClick={onCancel} disabled={busy}>
            취소
          </Button>
        ) : null}
        <Button variant="primary" disabled={busy}>
          {busy ? "저장 중…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
