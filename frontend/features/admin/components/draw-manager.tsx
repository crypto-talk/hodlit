"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import PageLinks from "@/components/page-links";
import { Button } from "@/components/ui/button";
import { adminDrawsHref } from "@/lib/routes";
import { useNow } from "@/lib/use-now";
import { createDrawEvent, loadAdminDrawEvents } from "../api";
import { adminDrawPhase, formatKst } from "../draw-events";
import { adminErrorMessage } from "../error-message";
import type { AdminDrawEvent, DrawEventInput } from "../types";
import DrawEventForm from "./draw-event-form";
import DrawEventPanel from "./draw-event-panel";
import DrawPhaseChip from "./draw-phase-chip";

/**
 * 관리자 뽑기 이벤트 관리 (HODL-94 · 96). 참여 화면 `/draw/[eventId]` 의 이벤트를 만들고 연다.
 *
 * - 목록은 최근에 만든 것부터, 쪽은 주소의 `?page=` 다(구조 규칙 8)
 * - 줄을 누르면 그 아래에 설정이 열린다. 한 번에 하나만(방 관리와 같은 아코디언)
 * - 순서: 만들기(초안) → 상품 넣기 → 열기. 열면 설정이 잠기고, 그 뒤로는 종료 전까지 중지 ↔ 다시
 *   열기만 된다
 * - 당첨자 목록 · 지급 처리는 없다. 그런 API 가 없고, 뽑기 결과는 "무엇이 나왔는지"의 기록일 뿐이다
 */
export default function DrawManager({ page }: { page: number }) {
  const router = useRouter();
  const client = useQueryClient();
  const now = useNow();
  const [adding, setAdding] = useState(false);
  /** 설정이 펼쳐진 이벤트. 한 번에 하나만 펼친다. */
  const [expanded, setExpanded] = useState<number | null>(null);

  const events = useQuery({
    queryKey: ["admin", "draw-events", page],
    queryFn: () => loadAdminDrawEvents(page),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: (input: DrawEventInput) => createDrawEvent(input),
    onSuccess: (created) => {
      setAdding(false);
      // 새 이벤트는 목록 맨 앞(1쪽)에 온다. 펼쳐서 바로 상품을 넣게 한다.
      setExpanded(created.id);
      toast.success("초안을 만들었습니다. 상품을 넣은 뒤 열어 주세요.");
      void client.invalidateQueries({ queryKey: ["admin", "draw-events"] });
      if (page !== 1) router.push(adminDrawsHref());
    },
    onError: (error) => toast.error(adminErrorMessage(error, "이벤트를 만들지 못했습니다.")),
  });

  const data = events.data;

  return (
    <section aria-labelledby="admin-draws-title" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-draws-title" className="text-h2 font-semibold">
          뽑기 관리
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          만들기 → 상품 넣기 → 열기 순서입니다. 열면 기본 정보와 상품이 잠기고, 그 뒤로는 종료
          전까지 중지 · 다시 열기만 됩니다. 시각은 모두 한국 시간입니다.
        </p>
      </div>

      {adding ? (
        <div className="rounded-lg border border-border-subtle bg-surface p-4">
          <h3 className="mb-4 font-semibold text-text-primary">새 이벤트 만들기</h3>
          <DrawEventForm
            submitLabel="초안 만들기"
            busy={create.isPending}
            onSubmit={(input) => create.mutate(input)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <div>
          <Button type="button" variant="primary" onClick={() => setAdding(true)}>
            새 이벤트 만들기
          </Button>
        </div>
      )}

      {events.isPending ? (
        <p className="py-8 text-center text-sm text-text-muted">불러오는 중…</p>
      ) : events.isError || !data ? (
        <p className="py-8 text-center text-sm text-text-muted">
          이벤트 목록을 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void events.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : data.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          {page > 1 ? "이 쪽에는 이벤트가 없습니다." : "만든 이벤트가 없습니다."}
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">이벤트 {data.totalElements}개</p>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {data.items.map((event) => {
              const open = expanded === event.id;
              return (
                <li key={event.id}>
                  <EventRow
                    event={event}
                    now={now}
                    expanded={open}
                    onToggle={() => setExpanded(open ? null : event.id)}
                  />
                  {open ? <DrawEventPanel summary={event} now={now} /> : null}
                </li>
              );
            })}
          </ul>
          <PageLinks page={data.page} totalPages={data.totalPages} hrefFor={adminDrawsHref} />
        </>
      )}
    </section>
  );
}

function EventRow({
  event,
  now,
  expanded,
  onToggle,
}: {
  event: AdminDrawEvent;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={`draw-event-${event.id}`}
      className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-surface-muted/50 ${
        expanded ? "bg-surface-muted/50" : ""
      }`}
    >
      <DrawPhaseChip phase={adminDrawPhase(event, now)} />
      <span className="min-w-0 flex-1 truncate font-semibold text-text-primary">{event.title}</span>
      <span className="flex-none text-xs text-text-muted">상품 {event.prizes.length}개</span>
      <ChevronDown
        aria-hidden
        className={`size-4 flex-none text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
      />
      <span className="basis-full text-xs text-text-muted tabular-nums">
        {formatKst(event.startsAt)} ~ {formatKst(event.endsAt)}
      </span>
    </button>
  );
}
