"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/time";
import { ApiError } from "@/lib/http";
import { useSession } from "@/lib/session";
import { draw, drawEventQueryKey, drawResultQueryKey, loadDrawEvent, loadDrawResult } from "../api";
import { drawPhase } from "../phase";
import type { DrawEvent, DrawPhase, DrawResult } from "../types";

/**
 * 뽑기 이벤트 화면 (HODL-95).
 *
 * - **뽑는 것은 버튼을 눌렀을 때뿐이다.** 화면에 들어오거나 다시 그려진다고 요청이 나가지 않는다
 * - 무엇이 나올지는 서버가 정한다. 화면은 서버가 돌려준 결과만 보여 준다
 * - 이미 참여했으면 버튼 대신 그 결과를 보여 준다. 새로고침 · 다시 로그인 · 다른 기기에서도 같다
 * - 응답을 못 받았을 때(네트워크 끊김 · 시간 초과)는 "안 뽑혔다"고 단정하지 않는다. 내 결과를 다시
 *   물어보고, 있으면 그것을 보여 준다. 없을 때만 다시 눌러 달라고 한다 — 다시 눌러도 서버는 한 번만 뽑는다
 * - 결과는 "무엇이 나왔는지"의 기록이다. 지급 · 발송은 여기서 일어나지 않으므로 그렇게 적는다
 */
export default function DrawView({ eventId }: { eventId: number }) {
  const { member, restored } = useSession();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const memberId = member?.id ?? null;
  const resultKey = drawResultQueryKey(eventId, memberId);
  /** 응답을 못 받아 내 결과를 다시 확인하는 중. */
  const [recovering, setRecovering] = useState(false);
  const now = useNow();

  const event = useQuery({
    queryKey: drawEventQueryKey(eventId),
    queryFn: () => loadDrawEvent(eventId),
    retry: false,
    // 시작 · 종료 · 중지가 화면을 켜 둔 사이에 바뀔 수 있다. 1분마다 다시 받는다.
    refetchInterval: 60_000,
  });
  const result = useQuery({
    queryKey: resultKey,
    queryFn: () => loadDrawResult(eventId),
    // 로그인한 사람만, 이벤트가 있을 때만 묻는다.
    enabled: restored && memberId !== null && event.isSuccess,
    retry: false,
  });

  const attempt = useMutation({
    mutationFn: () => draw(eventId),
    onSuccess: (next) => {
      queryClient.setQueryData(resultKey, next);
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        // 그 사이 이벤트가 끝났거나 멈췄다. 참여로 치지 않는다고 서버가 보장한다.
        toast.error("지금은 참여할 수 없는 이벤트입니다.");
        void queryClient.invalidateQueries({ queryKey: drawEventQueryKey(eventId) });
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        toast.error("로그인이 풀렸습니다. 다시 로그인해 주세요.");
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        toast.error("이벤트를 찾을 수 없습니다.");
        return;
      }

      // 응답을 못 받았다. 서버에서는 이미 뽑혔을 수 있으니 내 결과부터 다시 확인한다.
      setRecovering(true);
      try {
        const recovered = await queryClient.fetchQuery({
          queryKey: resultKey,
          queryFn: () => loadDrawResult(eventId),
          staleTime: 0,
        });
        if (!recovered) {
          toast.error("참여가 확인되지 않았습니다. 다시 눌러 주세요. 결과는 한 번만 정해집니다.");
        }
      } catch {
        toast.error("결과를 확인하지 못했습니다. 잠시 후 새로고침해 주세요.");
      } finally {
        setRecovering(false);
      }
    },
  });

  if (event.isPending) return <Notice>이벤트를 불러오는 중…</Notice>;

  if (event.isError) {
    const missing = event.error instanceof ApiError && event.error.status === 404;
    return (
      <Notice title={missing ? "이벤트를 찾을 수 없습니다" : "이벤트를 불러오지 못했습니다"}>
        {missing ? (
          <>
            주소가 바뀌었거나 아직 열리지 않은 이벤트입니다.{" "}
            <Link href="/" className="text-brand hover:underline">
              홈으로
            </Link>
          </>
        ) : (
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void event.refetch()}
          >
            다시 시도
          </button>
        )}
      </Notice>
    );
  }

  const data = event.data;
  const mine = result.data ?? null;
  // 내 결과를 아직 모르는 동안에는 버튼을 내놓지 않는다. 이미 참여한 사람에게 뽑기 버튼이 잠깐 보이면 안 된다.
  const checking = !restored || (memberId !== null && result.isPending) || recovering;
  const phase = drawPhase(data, mine, now);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold text-brand">이벤트</p>
        <h1 className="mt-1 text-h1 font-semibold break-words text-text-primary">{data.title}</h1>
        <p className="mt-2 text-sm text-text-muted">
          {formatDateTime(data.startsAt)} ~ {formatDateTime(data.endsAt)} · 한 사람이 한 번 참여할
          수 있습니다
        </p>
        {data.description ? (
          <p className="mt-3 text-body break-words whitespace-pre-line text-text-primary">
            {data.description}
          </p>
        ) : null}
      </header>

      <section
        aria-label="참여"
        aria-busy={checking || attempt.isPending}
        className="rounded-lg border border-border-subtle bg-surface p-6"
      >
        {mine ? (
          <ResultCard result={mine} />
        ) : result.isError ? (
          <div className="text-center">
            <p className="text-sm text-text-muted">내 참여 기록을 확인하지 못했습니다.</p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-brand hover:underline"
              onClick={() => void result.refetch()}
            >
              다시 확인
            </button>
          </div>
        ) : checking ? (
          <p className="text-center text-sm text-text-muted">
            {recovering ? "결과를 확인하는 중…" : "참여 기록을 확인하는 중…"}
          </p>
        ) : (
          <Entry
            phase={phase}
            event={data}
            loggedIn={memberId !== null}
            loginHref={`/login?next=${encodeURIComponent(pathname)}`}
            busy={attempt.isPending}
            onDraw={() => attempt.mutate()}
          />
        )}
      </section>

      <section aria-labelledby="draw-prizes-title">
        <h2 id="draw-prizes-title" className="text-h2 font-semibold text-text-primary">
          상품
        </h2>
        {data.prizes.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">상품 안내가 아직 없습니다.</p>
        ) : (
          <ul className="mt-3 grid gap-3 min-[600px]:grid-cols-2">
            {data.prizes.map((prize) => (
              <li
                key={prize.id}
                className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface p-4"
              >
                {prize.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버 · 바깥 이미지. next/image 원격 설정 전
                  <img
                    src={prize.image}
                    alt=""
                    loading="lazy"
                    className="size-16 flex-none rounded-sm border border-border-subtle bg-canvas object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-semibold break-words text-text-primary">{prize.name}</p>
                  {prize.description ? (
                    <p className="mt-1 text-sm break-words whitespace-pre-line text-text-muted">
                      {prize.description}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-text-muted">
          무엇이 나올지는 서버가 정합니다. 화면에서 고르거나 바꿀 수 없습니다.
        </p>
      </section>
    </div>
  );
}

/**
 * 지금 시각. 30초마다 다시 본다 — 화면을 켜 둔 채 시작 시각이 지나면 "시작 전" 안내가 풀려야 한다.
 * 정확한 판정은 서버가 한다. 기간이 지난 뒤 버튼을 눌러도 409 로 막힌다.
 */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const CLOSED_COPY: Record<Exclude<DrawPhase, "done" | "open">, { title: string; body: string }> = {
  before: { title: "아직 시작 전입니다", body: "시작 시각이 되면 여기서 참여할 수 있습니다." },
  ended: { title: "끝난 이벤트입니다", body: "참여 기간이 지났습니다." },
  paused: {
    title: "잠시 멈춘 이벤트입니다",
    body: "운영진이 참여를 잠시 멈췄습니다. 나중에 다시 확인해 주세요.",
  },
};

function Entry({
  phase,
  event,
  loggedIn,
  loginHref,
  busy,
  onDraw,
}: {
  phase: DrawPhase;
  event: DrawEvent;
  loggedIn: boolean;
  loginHref: string;
  busy: boolean;
  onDraw: () => void;
}) {
  if (phase === "before" || phase === "ended" || phase === "paused") {
    const copy = CLOSED_COPY[phase];
    return (
      <div className="text-center">
        <p className="font-semibold text-text-primary">{copy.title}</p>
        <p className="mt-1 text-sm text-text-muted">
          {copy.body}
          {phase === "before" ? ` 시작: ${formatDateTime(event.startsAt)}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-text-muted">한 번 뽑으면 결과가 정해지고 다시 뽑을 수 없습니다.</p>
      {loggedIn ? (
        <Button
          type="button"
          variant="primary"
          className="min-w-40"
          onClick={onDraw}
          disabled={busy}
        >
          {busy ? "뽑는 중…" : "뽑기"}
        </Button>
      ) : (
        <>
          <Button asChild variant="primary" className="min-w-40">
            <Link href={loginHref}>로그인하고 참여</Link>
          </Button>
          <p className="text-xs text-text-muted">로그인하면 이 화면으로 돌아옵니다.</p>
        </>
      )}
    </div>
  );
}

function ResultCard({ result }: { result: DrawResult }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-fade-in">
      <p className="text-xs font-semibold text-success">참여 완료</p>
      {result.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버 · 바깥 이미지. next/image 원격 설정 전
        <img
          src={result.image}
          alt={`${result.prizeName} 이미지`}
          className="size-32 rounded-lg border border-border-subtle bg-canvas object-cover"
        />
      ) : null}
      <p className="text-h1 font-semibold break-words text-text-primary">{result.prizeName}</p>
      {result.capturedAt ? (
        <p className="text-xs text-text-muted">{formatDateTime(result.capturedAt)} 확정</p>
      ) : null}
      <p className="max-w-md text-xs text-text-muted">
        뽑기 결과 기록입니다. 상품 지급 · 발송은 여기서 이루어지지 않으며, 방법은 운영진이 따로
        안내합니다.
      </p>
    </div>
  );
}

function Notice({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="py-16 text-center">
      {title ? <h1 className="text-h2 font-semibold text-text-primary">{title}</h1> : null}
      <p className="mt-2 text-sm text-text-muted">{children}</p>
    </div>
  );
}
