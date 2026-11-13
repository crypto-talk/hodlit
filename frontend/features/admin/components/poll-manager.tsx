"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import { adminPollsHref } from "@/lib/routes";
import { closePoll, createPoll, loadActivePoll } from "../api";
import { adminErrorMessage } from "../error-message";
import type { PollInput } from "../types";
import PollForm from "./poll-form";
import RoomPicker from "./room-picker";

/**
 * 관리자 방 투표 관리 (HODL-111). 방마다 지금 열린 투표를 보고, 새로 만들거나 닫는다.
 *
 * - 방에는 열린 투표가 하나뿐이다. 새로 만들면 열려 있던 투표는 서버가 닫는다 — 그래서 열린
 *   투표가 있을 때는 확인 창에서 그 사실을 먼저 알린다
 * - 닫아도 참여 기록은 남는다. 새 참여만 막힌다
 * - 한 번 만든 투표는 매일 다시 만들 필요가 없다. 닫기 전까지 열려 있고 한국 자정마다 참여만 새로 시작된다
 * - **표 수는 여기서도 보이지 않는다.** 오늘 참여하지 않은 사람에게 집계를 보이지 않는 정책은
 *   관리자에게도 같다. 결과는 방 게시판의 지난 투표 결과에서 본다
 */
export default function PollManager({ room }: { room: string | null }) {
  const queryClient = useQueryClient();
  const [pendingInput, setPendingInput] = useState<PollInput | null>(null);
  const [closing, setClosing] = useState(false);
  /** 만들 때마다 폼을 새로 그려 입력을 비운다. */
  const [formKey, setFormKey] = useState(0);
  const cancelCreate = useCallback(() => setPendingInput(null), []);
  const cancelClose = useCallback(() => setClosing(false), []);

  const poll = useQuery({
    queryKey: ["admin", "poll", room],
    queryFn: () => loadActivePoll(room ?? ""),
    enabled: Boolean(room),
    retry: false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "poll", room] });
    // 사용자 화면(방 게시판 · 랜딩)의 투표 칸도 다음에 새로 받게 한다.
    void queryClient.invalidateQueries({ queryKey: ["room-poll"] });
    void queryClient.invalidateQueries({ queryKey: ["open-polls"] });
  };

  const create = useMutation({
    mutationFn: (input: PollInput) => createPoll(room ?? "", input),
    onSuccess: () => {
      setPendingInput(null);
      setFormKey((key) => key + 1);
      toast.success("새 투표를 열었습니다.");
      refresh();
    },
    onError: (error) => {
      setPendingInput(null);
      toast.error(adminErrorMessage(error, "투표를 만들지 못했습니다."));
    },
  });
  const close = useMutation({
    mutationFn: (pollId: number) => closePoll(pollId),
    onSuccess: () => {
      setClosing(false);
      toast.success("투표를 닫았습니다. 참여 기록은 그대로 남습니다.");
      refresh();
    },
    onError: (error) => {
      setClosing(false);
      toast.error(adminErrorMessage(error, "투표를 닫지 못했습니다."));
    },
  });

  const active = poll.data ?? null;
  const closedRoom =
    poll.error instanceof ApiError &&
    poll.error.status === 403 &&
    poll.error.code === "ROOM_CLOSED";

  return (
    <section aria-labelledby="admin-polls-title" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-polls-title" className="text-h2 font-semibold">
          투표 관리
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          방마다 열린 투표는 하나입니다. 한 번 만들면 닫기 전까지 열려 있고, 한국 자정마다 참여만
          새로 시작됩니다.
        </p>
      </div>

      <RoomPicker room={room} hrefFor={adminPollsHref} />

      {!room ? (
        <p className="py-8 text-center text-sm text-text-muted">투표를 관리할 방을 골라 주세요.</p>
      ) : poll.isPending ? (
        <p className="py-8 text-center text-sm text-text-muted">불러오는 중…</p>
      ) : poll.isError ? (
        <p className="py-8 text-center text-sm text-text-muted">
          {closedRoom
            ? `${room} 방이 닫혀 있어 투표를 볼 수 없습니다. 방을 연 뒤 다시 확인해 주세요. `
            : "지금 투표를 불러오지 못했습니다. "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void poll.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <h3 className="text-sm font-semibold text-text-muted">{room} 방의 지금 투표</h3>
            {active ? (
              <>
                <p className="mt-2 font-semibold break-words text-text-primary">
                  {active.question}
                </p>
                <ol className="mt-2 flex flex-wrap gap-2">
                  {active.choices.map((choice) => (
                    <li
                      key={choice.id}
                      className="rounded-sm border border-border-subtle px-2 py-1 text-sm break-words text-text-primary"
                    >
                      {choice.label}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-text-muted">
                  표 수는 여기서 보이지 않습니다. 오늘 참여한 사람만 오늘 집계를 봅니다.
                </p>
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    className="text-danger hover:border-danger"
                    onClick={() => setClosing(true)}
                    disabled={close.isPending || create.isPending}
                  >
                    이 투표 닫기
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-text-muted">
                열린 투표가 없습니다. 사용자 화면의 투표 칸은 비어 있습니다.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <h3 className="font-semibold text-text-primary">새 투표 만들기</h3>
            <p className="mt-1 mb-4 text-sm text-text-muted">
              {active
                ? "만들면 지금 투표는 닫히고 새 투표가 열립니다. 지금 투표의 참여 기록은 남습니다."
                : "만드는 즉시 사용자 화면에 열립니다."}{" "}
              만든 뒤에는 질문 · 선택지를 고칠 수 없습니다.
            </p>
            <PollForm
              key={formKey}
              busy={create.isPending}
              onSubmit={(input) => (active ? setPendingInput(input) : create.mutate(input))}
            />
          </div>
        </>
      )}

      {pendingInput && active ? (
        <ConfirmDialog
          title="지금 투표를 닫고 새 투표를 열까요?"
          confirmLabel="새 투표 열기"
          busyLabel="여는 중…"
          tone="primary"
          busy={create.isPending}
          onCancel={cancelCreate}
          onConfirm={() => create.mutate(pendingInput)}
        >
          <p className="break-words">닫히는 투표: {active.question}</p>
          <p className="break-words">새 투표: {pendingInput.question}</p>
          <p>닫히는 투표의 참여 기록은 지워지지 않습니다.</p>
        </ConfirmDialog>
      ) : null}

      {closing && active ? (
        <ConfirmDialog
          title="이 투표를 닫을까요?"
          confirmLabel="닫기"
          busyLabel="닫는 중…"
          busy={close.isPending}
          onCancel={cancelClose}
          onConfirm={() => close.mutate(active.id)}
        >
          <p className="break-words">{active.question}</p>
          <p>닫으면 새로 참여할 수 없습니다. 참여 기록은 그대로 남습니다.</p>
          <p>다시 열 수는 없습니다. 같은 질문이 필요하면 새 투표를 만듭니다.</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
