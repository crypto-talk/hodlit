"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { changeModeration, loadModeration, loadModerationDetail, loadModerationLogs } from "../api";

type Props = {
  type: "posts" | "members" | "logs";
  q: string;
  page: number;
  state: string;
  navigate: (q: string, page: number, state: string) => void;
};

const CARD = "rounded-lg border border-border-subtle bg-surface";

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
  const [selected, setSelected] = useState<number | null>(null);
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
    mutationFn: ({ id, enabled, reason }: { id: number; enabled: boolean; reason: string }) =>
      changeModeration(type === "members" ? "members" : "posts", id, enabled, reason),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["moderation"] });
      await client.invalidateQueries({ queryKey: ["moderation-detail"] });
      await client.invalidateQueries({ queryKey: ["moderation-logs"] });
    },
  });
  const result = type === "logs" ? logs : rows;
  const flaggedLabel = type === "posts" ? "숨김" : "정지";

  return (
    <section className="flex flex-col gap-4">
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
                  <p className="text-sm font-semibold text-text-primary">
                    {log.target_type} #{log.target_id}
                    <span className="ml-2 font-normal text-text-muted">
                      {log.before_state} → {log.after_state}
                    </span>
                  </p>
                  <p className="text-sm text-text-primary">{log.reason}</p>
                  <p className="text-xs text-text-subtle">
                    관리자 #{log.actor_id} · {log.created_at}
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
                      onClick={() => setSelected(row.id)}
                      aria-pressed={active}
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
                    </button>
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
      {selected !== null && (
        <section className={`${CARD} flex flex-col gap-4 p-5`} aria-label="관리 대상 상세">
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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-h2 font-semibold break-words text-text-primary">
                      {detail.data.title ?? detail.data.nickname}
                    </h2>
                    <div className="mt-1">
                      <StateChip
                        flagged={Boolean(
                          type === "posts" ? detail.data.hidden : detail.data.suspended,
                        )}
                        label={
                          (type === "posts" ? detail.data.hidden : detail.data.suspended)
                            ? flaggedLabel
                            : "정상"
                        }
                      />
                    </div>
                  </div>
                  <Button type="button" className="flex-none" onClick={() => setSelected(null)}>
                    상세 닫기
                  </Button>
                </div>
                {detail.data.content != null && (
                  <p className="max-h-80 overflow-y-auto rounded-sm bg-surface-muted p-4 text-sm whitespace-pre-wrap break-words text-text-primary">
                    {detail.data.content}
                  </p>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const reason = String(new FormData(e.currentTarget).get("reason"));
                    const enabled = !(type === "posts"
                      ? detail.data?.hidden
                      : detail.data?.suspended);
                    if (confirm("해당 관리 조치를 적용할까요?"))
                      action.mutate({ id: selected, enabled, reason });
                  }}
                  className="flex flex-wrap items-end gap-2 border-t border-border-subtle pt-4"
                >
                  <label className="flex min-w-60 flex-1 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-text-muted">조치 사유</span>
                    <Input name="reason" required maxLength={500} />
                  </label>
                  <Button
                    disabled={action.isPending}
                    className={
                      (type === "posts" ? detail.data.hidden : detail.data.suspended)
                        ? ""
                        : "text-danger hover:border-danger"
                    }
                  >
                    {type === "posts"
                      ? detail.data.hidden
                        ? "복구"
                        : "숨김"
                      : detail.data.suspended
                        ? "정지 해제"
                        : "이용 정지"}
                  </Button>
                </form>
                {action.isError && (
                  <p role="alert" className="text-sm text-danger">
                    {action.error.message}
                  </p>
                )}
                {action.isSuccess && (
                  <p role="status" className="text-sm text-success">
                    조치를 적용했습니다.
                  </p>
                )}
              </>
            )
          )}
        </section>
      )}
    </section>
  );
}
