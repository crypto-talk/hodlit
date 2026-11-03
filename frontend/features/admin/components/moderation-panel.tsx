"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { changeModeration, loadModeration, loadModerationDetail, loadModerationLogs } from "../api";

type Props = {
  type: "posts" | "members" | "logs";
  q: string;
  page: number;
  state: string;
  navigate: (q: string, page: number, state: string) => void;
};

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

  return (
    <section className="space-y-4">
      {type !== "logs" && (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            navigate(String(data.get("q")), 0, String(data.get("state")));
          }}
        >
          <input
            name="q"
            aria-label="관리 대상 검색"
            defaultValue={q}
            maxLength={100}
            className="border p-2"
          />
          <select name="state" aria-label="상태 필터" defaultValue={state} className="border p-2">
            <option value="">전체 상태</option>
            <option value="false">정상</option>
            <option value="true">{type === "posts" ? "숨김" : "정지"}</option>
          </select>
          <button>검색</button>
        </form>
      )}
      {result.isPending ? (
        <p>목록 불러오는 중…</p>
      ) : result.isError ? (
        <button onClick={() => result.refetch()}>목록 재시도</button>
      ) : (
        <>
          <p>{result.data.totalElements}건</p>
          {type === "logs" ? (
            <ul className="space-y-3">
              {logs.data?.items.map((log) => (
                <li key={log.id} className="rounded border p-3">
                  <b>
                    {log.target_type} #{log.target_id}
                  </b>{" "}
                  · {log.before_state} → {log.after_state}
                  <p>{log.reason}</p>
                  <small>
                    관리자 #{log.actor_id} · {log.created_at}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-3">
              {rows.data?.items.map((row) => (
                <li key={row.id} className="rounded border p-3">
                  <button onClick={() => setSelected(row.id)} className="font-semibold text-brand">
                    #{row.id} {row.title ?? row.nickname}
                  </button>
                  <p>
                    {type === "posts"
                      ? `${row.symbol} · ${row.nickname} · ${row.hidden ? "숨김" : "정상"}`
                      : `${row.role} · ${row.suspended ? "정지" : "정상"}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {result.data.items.length === 0 && <p>결과가 없습니다.</p>}
          <div className="flex gap-4">
            <button disabled={page === 0} onClick={() => navigate(q, page - 1, state)}>
              이전
            </button>
            <span>
              {page + 1} / {Math.max(1, result.data.totalPages)}
            </span>
            <button
              disabled={page + 1 >= result.data.totalPages}
              onClick={() => navigate(q, page + 1, state)}
            >
              다음
            </button>
          </div>
        </>
      )}
      {selected !== null && (
        <section className="space-y-3 rounded border p-4" aria-label="관리 대상 상세">
          <button onClick={() => setSelected(null)}>상세 닫기</button>
          {detail.isPending ? (
            <p>상세 불러오는 중…</p>
          ) : detail.isError ? (
            <button onClick={() => detail.refetch()}>상세 재시도</button>
          ) : (
            detail.data && (
              <>
                <h2 className="font-semibold">{detail.data.title ?? detail.data.nickname}</h2>
                <p className="whitespace-pre-wrap break-words">
                  {detail.data.content ?? `계정 상태: ${detail.data.suspended ? "정지" : "정상"}`}
                </p>
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
                  className="flex flex-wrap gap-3"
                >
                  <label>
                    조치 사유{" "}
                    <input name="reason" required maxLength={500} className="border p-2" />
                  </label>
                  <button disabled={action.isPending}>
                    {type === "posts"
                      ? detail.data.hidden
                        ? "복구"
                        : "숨김"
                      : detail.data.suspended
                        ? "정지 해제"
                        : "이용 정지"}
                  </button>
                </form>
                {action.isError && <p role="alert">{action.error.message}</p>}
                {action.isSuccess && <p role="status">조치를 적용했습니다.</p>}
              </>
            )
          )}
        </section>
      )}
    </section>
  );
}
