"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminPollsHref } from "@/lib/routes";
import { loadPollForDeletion } from "../api";
import { parsePollNumber, pollDeletionError } from "../poll-deletion";
import type { AdminPoll } from "../types";

type Props = {
  room: string;
  pollId: number | null;
  busy: boolean;
  onDelete: (poll: AdminPoll) => void;
};

/** 종료된 투표는 전체 목록 API가 없어 기존 번호 조회를 사용한다. 선택은 URL에 남긴다. */
export default function PollLookup({ room, pollId, busy, onDelete }: Props) {
  const router = useRouter();
  const [number, setNumber] = useState(pollId?.toString() ?? "");
  const [problem, setProblem] = useState("");
  const poll = useQuery({
    queryKey: ["admin", "poll-detail", pollId],
    queryFn: () => loadPollForDeletion(pollId!),
    enabled: pollId !== null,
    retry: false,
  });
  const target = poll.isError ? null : poll.data;

  return (
    <section
      className="rounded-lg border border-border-subtle bg-surface p-4"
      aria-labelledby="poll-lookup-title"
    >
      <h3 id="poll-lookup-title" className="font-semibold text-text-primary">
        투표 번호로 찾기
      </h3>
      <p className="mt-1 text-sm text-text-muted">종료된 투표도 번호로 찾아 삭제할 수 있습니다.</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const id = parsePollNumber(number);
          if (id === null) {
            setProblem("올바른 투표 번호를 입력해 주세요.");
            return;
          }
          setProblem("");
          if (id === pollId) void poll.refetch();
          else router.push(adminPollsHref(room, id));
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          투표 번호
          <Input
            inputMode="numeric"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            disabled={busy}
            aria-invalid={Boolean(problem)}
            aria-describedby={problem ? "poll-number-problem" : undefined}
          />
        </label>
        <Button disabled={busy || poll.isFetching}>조회</Button>
      </form>
      {problem ? (
        <p id="poll-number-problem" role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      ) : null}
      {pollId && poll.isPending ? (
        <p className="mt-3 text-sm text-text-muted">투표를 불러오는 중…</p>
      ) : null}
      {pollId && poll.isError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {pollDeletionError(poll.error)}
        </p>
      ) : null}
      {target ? (
        <div className="mt-4 border-t border-border-subtle pt-4">
          <p className="text-xs text-text-muted">
            {target.coinSymbol} · 투표 #{target.id} · {target.active ? "진행 중" : "종료됨"}
          </p>
          <p className="mt-1 font-semibold break-words">{target.question}</p>
          {target.coinSymbol.toUpperCase() !== room.toUpperCase() ? (
            <p className="mt-2 text-sm text-text-muted">
              선택한 방의 투표가 아닙니다.{" "}
              <Link
                className="text-brand hover:underline"
                href={adminPollsHref(target.coinSymbol, target.id)}
              >
                해당 방에서 확인
              </Link>
            </p>
          ) : (
            <Button
              type="button"
              className="mt-3 text-danger hover:border-danger"
              disabled={busy || poll.isFetching}
              onClick={() => onDelete(target)}
            >
              조회한 투표 삭제
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
