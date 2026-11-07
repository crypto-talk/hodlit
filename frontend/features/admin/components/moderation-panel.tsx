"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateTime } from "@/lib/format/time";
import { useSession } from "@/lib/session";
import { changeModeration, loadModeration, loadModerationDetail, loadModerationLogs } from "../api";
import { isHeavyModeration, moderationAction, moderationTarget } from "../moderation-log";

type Props = {
  type: "posts" | "members" | "logs";
  q: string;
  page: number;
  state: string;
  navigate: (q: string, page: number, state: string) => void;
};

const CARD = "rounded-lg border border-border-subtle bg-surface";

/** 화면별 제목 · 설명. 관리자 틀의 "관리자" 제목 아래에 온다. */
const HEADING: Record<Props["type"], { title: string; description: string }> = {
  posts: {
    title: "글 관리",
    description:
      "숨긴 글은 사용자 화면 · 검색 · 통계에서 빠집니다. 지우지 않고, 복구하면 그대로 보입니다.",
  },
  members: {
    title: "회원 관리",
    description: "정지한 회원은 로그인과 토큰 갱신이 막힙니다. 관리자 계정은 정지할 수 없습니다.",
  },
  logs: {
    title: "관리 이력",
    description: "글 숨김 · 회원 정지 · 방 운영 상태 · 방과 카테고리 변경 기록입니다.",
  },
};

/** 확인 창에 넘길 조치. 사유는 상세 칸에서 먼저 받는다. */
type Pending = {
  id: number;
  enabled: boolean;
  reason: string;
  label: string;
  /** 확인 창 제목. `"제목" 글을 숨길까요?` */
  question: string;
  /** 성공 토스트. `"제목" 글을 숨겼습니다.` */
  done: string;
};

/** 버튼 문구 → [묻는 말, 끝난 말]. */
const VERB: Record<string, [string, string]> = {
  숨김: ["숨길까요?", "숨겼습니다."],
  복구: ["복구할까요?", "복구했습니다."],
  "이용 정지": ["이용 정지할까요?", "이용 정지했습니다."],
  "정지 해제": ["정지 해제할까요?", "정지 해제했습니다."],
};

/** 정상은 옅게, 숨김 · 정지는 눈에 띄게. */
function StateChip({ flagged, label }: { flagged: boolean; label: string }) {
  return (
    <span
      className={`flex-none rounded-sm px-1.5 py-0.5 text-xs font-semibold ${
        flagged ? "bg-danger/10 text-danger" : "text-text-subtle"
      }`}
    >
      {label}
    </span>
  );
}

export default function ModerationPanel({ type, q, page, state, navigate }: Props) {
  const { member } = useSession();
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const client = useQueryClient();
  const rows = useQuery({
    queryKey: ["moderation", type, q, state, page],
    queryFn: () => loadModeration(type === "members" ? "members" : "posts", q, state, page),
    enabled: type !== "logs",
  });
  const logs = useQuery({
    queryKey: ["moderation-logs", page],
    queryFn: () => loadModerationLogs(page),
    enabled: type === "logs",
  });
  const detail = useQuery({
    queryKey: ["moderation-detail", type, selected],
    queryFn: () => loadModerationDetail(type === "members" ? "members" : "posts", selected!),
    enabled: selected !== null && type !== "logs",
  });
  const action = useMutation({
    mutationFn: ({ id, enabled, reason }: Pending) =>
      changeModeration(type === "members" ? "members" : "posts", id, enabled, reason),
    onSuccess: async (_, done) => {
      setPending(null);
      toast.success(done.done);
      await client.invalidateQueries({ queryKey: ["moderation"] });
      await client.invalidateQueries({ queryKey: ["moderation-detail"] });
      await client.invalidateQueries({ queryKey: ["moderation-logs"] });
    },
    onError: (error) => {
      setPending(null);
      toast.error(error.message || "조치를 적용하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });
  const result = type === "logs" ? logs : rows;
  const flaggedLabel = type === "posts" ? "숨김" : "정지";
  const heading = HEADING[type];

  const flaggedNow = Boolean(
    type === "posts" ? detail.data?.hidden : type === "members" ? detail.data?.suspended : false,
  );
  const actionLabel =
    type === "posts" ? (flaggedNow ? "복구" : "숨김") : flaggedNow ? "정지 해제" : "이용 정지";

  // 상세는 누른 줄 바로 아래에 펼친다(아코디언). 다시 누르면 접힌다.
  const detailBody = (
    <div
      id="moderation-detail"
      className="flex flex-col gap-4 border-t border-border-subtle bg-surface-muted/50 px-4 py-4"
    >
      {detail.isPending ? (
        <p className="py-6 text-center text-sm text-text-muted">상세 불러오는 중…</p>
      ) : detail.isError ? (
        <p className="py-6 text-center text-sm text-text-muted">
          상세를 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void detail.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : (
        detail.data && (
          <>
            {detail.data.content != null && (
              <p className="max-h-80 overflow-y-auto rounded-sm border border-border-subtle bg-surface p-4 text-sm whitespace-pre-wrap break-words text-text-primary">
                {detail.data.content}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const reason = String(new FormData(e.currentTarget).get("reason")).trim();
                if (!reason || selected === null) return;
                const name = detail.data?.title ?? detail.data?.nickname ?? `#${selected}`;
                const target = `"${name}" ${type === "posts" ? "글을" : "회원을"}`;
                const [ask, said] = VERB[actionLabel];
                setPending({
                  id: selected,
                  enabled: !flaggedNow,
                  reason,
                  label: actionLabel,
                  question: `${target} ${ask}`,
                  done: `${target} ${said}`,
                });
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="flex min-w-60 flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-text-muted">조치 사유</span>
                <Input name="reason" required maxLength={500} />
              </label>
              <Button
                disabled={action.isPending}
                className={flaggedNow ? "" : "text-danger hover:border-danger"}
              >
                {actionLabel}
              </Button>
            </form>
          </>
        )
      )}
    </div>
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="moderation-title">
      <div>
        <h2 id="moderation-title" className="text-h2 font-semibold">
          {heading.title}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{heading.description}</p>
      </div>

      {type !== "logs" && (
        <form
          role="search"
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            navigate(String(data.get("q")), 0, String(data.get("state")));
          }}
        >
          <Input
            name="q"
            type="search"
            aria-label="관리 대상 검색"
            placeholder={type === "posts" ? "제목 · 작성자" : "닉네임"}
            defaultValue={q}
            maxLength={100}
            className="w-56"
          />
          <NativeSelect name="state" aria-label="상태 필터" defaultValue={state} className="w-28">
            <option value="">전체 상태</option>
            <option value="false">정상</option>
            <option value="true">{flaggedLabel}</option>
          </NativeSelect>
          <Button type="submit">검색</Button>
        </form>
      )}
      {result.isPending ? (
        <p className="py-8 text-center text-sm text-text-muted">불러오는 중…</p>
      ) : result.isError ? (
        <p className="py-8 text-center text-sm text-text-muted">
          목록을 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void result.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">{result.data.totalElements}건</p>
          {result.data.items.length === 0 ? (
            <p className={`${CARD} py-10 text-center text-sm text-text-muted`}>결과가 없습니다.</p>
          ) : type === "logs" ? (
            <ul className={`${CARD} divide-y divide-border-subtle overflow-hidden`}>
              {logs.data?.items.map((log) => (
                <li key={log.id} className="flex flex-col gap-1 px-4 py-3">
                  <p className="text-sm text-text-primary">
                    <span className="font-semibold">{moderationTarget(log)}</span>
                    <span
                      className={`ml-2 font-semibold ${
                        isHeavyModeration(log) ? "text-danger" : "text-text-muted"
                      }`}
                    >
                      {moderationAction(log)}
                    </span>
                  </p>
                  {log.reason ? <p className="text-sm text-text-primary">{log.reason}</p> : null}
                  <p className="text-xs text-text-subtle tabular-nums">
                    {member?.id === log.actor_id ? "나" : `관리자 #${log.actor_id}`} ·{" "}
                    <time dateTime={log.created_at}>{formatDateTime(log.created_at)}</time>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={`${CARD} divide-y divide-border-subtle overflow-hidden`}>
              {rows.data?.items.map((row) => {
                const flagged = Boolean(type === "posts" ? row.hidden : row.suspended);
                const active = selected === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(active ? null : row.id)}
                      aria-expanded={active}
                      aria-controls={active ? "moderation-detail" : undefined}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted ${
                        active ? "bg-surface-muted" : ""
                      }`}
                    >
                      <span className="w-10 flex-none text-sm text-text-subtle tabular-nums">
                        #{row.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-text-primary">
                          {row.title ?? row.nickname}
                        </span>
                        <span className="block truncate text-sm text-text-muted">
                          {type === "posts" ? `${row.symbol} · ${row.nickname}` : row.role}
                        </span>
                      </span>
                      <StateChip flagged={flagged} label={flagged ? flaggedLabel : "정상"} />
                      <ChevronDown
                        aria-hidden
                        className={`size-4 flex-none text-text-muted transition-transform ${
                          active ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {active ? detailBody : null}
                  </li>
                );
              })}
            </ul>
          )}
          {result.data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                disabled={page === 0}
                onClick={() => navigate(q, page - 1, state)}
              >
                이전
              </Button>
              <span className="text-sm text-text-muted tabular-nums">
                {page + 1} / {Math.max(1, result.data.totalPages)}
              </span>
              <Button
                type="button"
                disabled={page + 1 >= result.data.totalPages}
                onClick={() => navigate(q, page + 1, state)}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}
      {pending ? (
        <ConfirmDialog
          title={pending.question}
          confirmLabel={pending.label}
          tone={pending.enabled ? "danger" : "primary"}
          busy={action.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => action.mutate(pending)}
        >
          <p>사유: {pending.reason}</p>
          <p>조치는 관리 이력에 남습니다.</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
