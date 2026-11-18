"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { drawHref } from "@/lib/routes";
import { loadAdminDrawEvent, saveDrawPrizes, setDrawEventStatus, updateDrawEvent } from "../api";
import {
  adminDrawPhase,
  formatKst,
  formatOdds,
  isEditable,
  lockReason,
  prizeOdds,
  samePrizes,
  statusAction,
  toEventInput,
  toPrizeInputs,
  type DrawStatusAction,
} from "../draw-events";
import { adminErrorMessage } from "../error-message";
import type { AdminDrawEvent, DrawEventInput, DrawPrizeInput } from "../types";
import DrawEventForm from "./draw-event-form";
import DrawPhaseChip from "./draw-phase-chip";
import DrawPrizeEditor from "./draw-prize-editor";

const SECTION_TITLE = "text-sm font-semibold text-text-primary";

const ACTION_COPY: Record<
  DrawStatusAction,
  { button: string; title: string; confirm: string; busy: string; done: string }
> = {
  open: {
    button: "이벤트 열기",
    title: "이 이벤트를 열까요?",
    confirm: "열기",
    busy: "여는 중…",
    done: "이벤트를 열었습니다. 시작 시각부터 참여할 수 있습니다.",
  },
  pause: {
    button: "중지",
    title: "참여를 멈출까요?",
    confirm: "중지",
    busy: "멈추는 중…",
    done: "이벤트를 멈췄습니다. 종료 전까지 다시 열 수 있습니다.",
  },
  resume: {
    button: "다시 열기",
    title: "이벤트를 다시 열까요?",
    confirm: "다시 열기",
    busy: "여는 중…",
    done: "이벤트를 다시 열었습니다.",
  },
};

/**
 * 뽑기 이벤트 한 건의 설정 (HODL-94 · 96). 목록에서 누른 줄 바로 아래에 펼쳐진다.
 *
 * - 열기 전(초안)에만 기본 정보 · 상품을 고칠 수 있다. 한 번 열면 서버가 잠그고, 여기서는 읽기
 *   전용으로 바꾸고 이유를 한 줄 적는다
 * - 상태 버튼은 확인 창을 거친다. 열기는 되돌릴 수 없는 잠금이라 그 사실을 확인 창에 적는다
 * - 상태는 화면이 시각으로 계산한 것이다. 최종 판단은 서버가 하고, 거절되면 그 문구를 토스트로 보인다
 */
export default function DrawEventPanel({
  summary,
  now,
}: {
  /** 목록에 있던 값. 상세를 받기 전에 먼저 그린다. */
  summary: AdminDrawEvent;
  now: number;
}) {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState<DrawStatusAction | null>(null);
  const cancelConfirm = useCallback(() => setConfirming(null), []);

  const queryKey = ["admin", "draw-event", summary.id] as const;
  const detail = useQuery({
    queryKey,
    queryFn: () => loadAdminDrawEvent(summary.id),
    placeholderData: summary,
  });
  const event = detail.data ?? summary;
  const phase = adminDrawPhase(event, now);
  const editable = isEditable(phase);
  const action = statusAction(phase);

  // 상품 편집 칸의 값. 저장된 상품이 바뀌면(저장 · 다시 받기) 편집 칸도 그 값으로 맞춘다.
  // 렌더 중에 맞춘다 — effect 로 하면 한 번 옛 값으로 그린다.
  const saved = toPrizeInputs(event.prizes);
  const [prizes, setPrizes] = useState<DrawPrizeInput[]>(saved);
  const [shownPrizes, setShownPrizes] = useState(event.prizes);
  if (shownPrizes !== event.prizes) {
    setShownPrizes(event.prizes);
    setPrizes(saved);
  }
  const prizesDirty = editable && !samePrizes(prizes, saved);

  // 저장하지 않은 상품 변경이 있으면 창을 닫거나 새로고침할 때 브라우저가 한 번 묻는다.
  useEffect(() => {
    if (!prizesDirty) return;
    const warn = (unload: BeforeUnloadEvent) => unload.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [prizesDirty]);

  const applied = (next: AdminDrawEvent) => {
    client.setQueryData(queryKey, next);
    void client.invalidateQueries({ queryKey: ["admin", "draw-events"] });
    // 참여 화면이 쥐고 있던 이벤트도 버린다(같은 브라우저에서 바로 확인할 때).
    void client.invalidateQueries({ queryKey: ["draw-event", next.id] });
  };

  const saveInfo = useMutation({
    mutationFn: (input: DrawEventInput) => updateDrawEvent(event.id, input),
    onSuccess: (next) => {
      toast.success("기본 정보를 저장했습니다.");
      applied(next);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "기본 정보를 저장하지 못했습니다.")),
  });
  const savePrizes = useMutation({
    mutationFn: () => saveDrawPrizes(event.id, prizes),
    onSuccess: (next) => {
      toast.success(`상품 ${next.prizes.length}개를 저장했습니다.`);
      applied(next);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "상품을 저장하지 못했습니다.")),
  });
  const changeStatus = useMutation({
    mutationFn: (next: DrawStatusAction) =>
      setDrawEventStatus(event.id, next === "pause" ? "PAUSED" : "ACTIVE"),
    onSuccess: (next, kind) => {
      setConfirming(null);
      toast.success(ACTION_COPY[kind].done);
      applied(next);
    },
    onError: (error) => {
      setConfirming(null);
      toast.error(adminErrorMessage(error, "상태를 바꾸지 못했습니다."));
      // 그 사이 다른 관리자가 바꿨을 수 있다. 다시 받는다.
      void detail.refetch();
    },
  });

  const busy = saveInfo.isPending || savePrizes.isPending || changeStatus.isPending;
  const openBlocked =
    action !== "open"
      ? null
      : event.prizes.length === 0
        ? "상품을 하나 이상 저장해야 열 수 있습니다."
        : prizesDirty
          ? "저장하지 않은 상품 변경이 있습니다. 저장하거나 되돌린 뒤 열어 주세요."
          : null;
  const reason = lockReason(phase);

  return (
    <div
      id={`draw-event-${event.id}`}
      className="flex flex-col gap-6 border-t border-border-subtle bg-surface-muted/50 px-4 py-5"
    >
      {detail.isError ? (
        <p className="text-sm text-text-muted">
          최신 설정을 불러오지 못해 목록의 값으로 보여 줍니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void detail.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : null}

      <section aria-label="운영 상태" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DrawPhaseChip phase={phase} />
          <span className="text-sm text-text-muted tabular-nums">
            {formatKst(event.startsAt)} ~ {formatKst(event.endsAt)} (한국 시간)
          </span>
          {action ? (
            <Button
              type="button"
              variant={action === "pause" ? "secondary" : "primary"}
              className={`ml-auto ${action === "pause" ? "text-danger hover:border-danger" : ""}`}
              disabled={busy || openBlocked !== null}
              onClick={() => setConfirming(action)}
            >
              {ACTION_COPY[action].button}
            </Button>
          ) : null}
        </div>
        {openBlocked ? <p className="text-right text-xs text-text-muted">{openBlocked}</p> : null}
        {phase === "paused" ? (
          <p className="text-xs text-text-muted">
            다시 열어도 참여 기록은 초기화되지 않습니다. 이미 뽑은 사람은 다시 뽑을 수 없습니다.
          </p>
        ) : null}

        <ParticipationLink
          eventId={event.id}
          published={phase !== "draft" && phase !== "expired"}
        />
      </section>

      <section aria-labelledby={`draw-info-${event.id}`} className="flex flex-col gap-3">
        <h3 id={`draw-info-${event.id}`} className={SECTION_TITLE}>
          기본 정보
        </h3>
        {reason ? <p className="text-xs text-text-muted">{reason}</p> : null}
        {editable ? (
          <DrawEventForm
            // 저장된 값이 바뀌면 폼을 새로 그려 입력을 저장된 값으로 맞춘다.
            key={`${event.title}|${event.description}|${event.startsAt}|${event.endsAt}`}
            initial={toEventInput(event)}
            submitLabel="기본 정보 저장"
            busy={saveInfo.isPending}
            onSubmit={(input) => saveInfo.mutate(input)}
          />
        ) : (
          <dl className="grid gap-x-4 gap-y-2 text-sm min-[600px]:grid-cols-[6rem_1fr]">
            <dt className="text-text-muted">제목</dt>
            <dd className="break-words text-text-primary">{event.title}</dd>
            <dt className="text-text-muted">설명</dt>
            <dd className="break-words whitespace-pre-line text-text-primary">
              {event.description || <span className="text-text-subtle">없음</span>}
            </dd>
          </dl>
        )}
      </section>

      <section aria-labelledby={`draw-prizes-${event.id}`} className="flex flex-col gap-3">
        <h3 id={`draw-prizes-${event.id}`} className={SECTION_TITLE}>
          상품 {event.prizes.length}개
        </h3>
        {editable ? (
          <DrawPrizeEditor
            prizes={prizes}
            onChange={setPrizes}
            dirty={prizesDirty}
            busy={busy}
            onSave={() => savePrizes.mutate()}
            onRevert={() => setPrizes(saved)}
          />
        ) : (
          <LockedPrizes event={event} />
        )}
      </section>

      {confirming ? (
        <ConfirmDialog
          title={ACTION_COPY[confirming].title}
          confirmLabel={ACTION_COPY[confirming].confirm}
          busyLabel={ACTION_COPY[confirming].busy}
          tone={confirming === "pause" ? "danger" : "primary"}
          busy={changeStatus.isPending}
          onCancel={cancelConfirm}
          onConfirm={() => changeStatus.mutate(confirming)}
        >
          <p className="break-words">{event.title}</p>
          {confirming === "open" ? (
            <>
              <p className="font-semibold text-text-primary">
                열면 기본 정보와 상품을 더 이상 고칠 수 없습니다.
              </p>
              <p>
                {formatKst(event.startsAt)}(한국 시간)부터 참여할 수 있습니다. 상품{" "}
                {event.prizes.length}개.
              </p>
              <p>연 뒤에는 종료 전까지 중지 · 다시 열기만 할 수 있습니다.</p>
            </>
          ) : confirming === "pause" ? (
            <>
              <p>멈추는 동안 아무도 새로 참여할 수 없습니다. 이미 뽑은 결과는 그대로 남습니다.</p>
              <p>종료 전까지 다시 열 수 있습니다.</p>
            </>
          ) : (
            <p>참여 기록은 초기화되지 않습니다. 이미 뽑은 사람은 다시 뽑을 수 없습니다.</p>
          )}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** 잠긴 이벤트의 상품. 가중치와 확률을 그대로 보여 준다(관리자만 보는 값). */
function LockedPrizes({ event }: { event: AdminDrawEvent }) {
  if (event.prizes.length === 0) {
    return <p className="text-sm text-text-muted">상품이 없습니다.</p>;
  }
  const odds = prizeOdds(event.prizes.map((prize) => prize.weight));
  return (
    <ol className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
      {event.prizes.map((prize, index) => (
        <li key={prize.id} className="flex items-center gap-3 px-4 py-3">
          {prize.imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버 · 바깥 주소의 원본. next/image 원격 설정 전
            <img
              src={prize.imageSrc}
              alt=""
              className="size-10 flex-none rounded-sm border border-border-subtle bg-canvas object-cover"
            />
          ) : (
            <span className="size-10 flex-none rounded-sm border border-dashed border-border-subtle" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-text-primary">{prize.name}</p>
            {prize.description ? (
              <p className="truncate text-xs text-text-muted">{prize.description}</p>
            ) : null}
          </div>
          <span className="flex-none text-right text-sm text-text-muted tabular-nums">
            가중치 {prize.weight}
            <br />
            <b className="font-semibold text-text-primary">{formatOdds(odds[index])}</b>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 참여 화면 주소와 복사 버튼. 배너 링크 칸에 그대로 넣는 값이다. */
function ParticipationLink({ eventId, published }: { eventId: number; published: boolean }) {
  const href = drawHref(eventId);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      toast.success("주소를 복사했습니다.");
    } catch {
      // http 로 띄운 화면 · 권한 거절에서는 클립보드를 쓸 수 없다. 주소는 화면에 보인다.
      toast.error("복사하지 못했습니다. 주소를 직접 선택해 복사해 주세요.");
    }
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-border-subtle bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">참여 화면</span>
        <Link
          href={href}
          target="_blank"
          className="font-mono text-sm break-all text-brand hover:underline"
        >
          {href}
        </Link>
        <Button
          type="button"
          className="ml-auto h-8 px-2.5 text-xs"
          onClick={() => void copy()}
          aria-label={`${href} 복사`}
        >
          <Copy />
          복사
        </Button>
      </div>
      <p className="text-xs text-text-subtle">
        배너 링크에 이 주소를 넣으면 홈에서 연결됩니다.
        {published ? "" : " 초안은 열기 전까지 이 주소에서 보이지 않습니다."}
      </p>
    </div>
  );
}
