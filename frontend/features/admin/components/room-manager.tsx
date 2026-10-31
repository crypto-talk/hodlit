"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import PageLinks from "@/components/page-links";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import { adminRoomsHref, type AdminRoomFilter } from "@/lib/routes";
import { loadAdminRooms, setRoomStatus } from "../api";
import type { AdminRoom, RoomOperationStatus } from "../types";

type Props = {
  q: string;
  status: AdminRoomFilter | null;
  /** 1부터. */
  page: number;
};

const FILTERS: { value: AdminRoomFilter | null; label: string }[] = [
  { value: null, label: "전체" },
  { value: "open", label: "열린 방" },
  { value: "closed", label: "닫힌 방" },
];

const FILTER_CLASS =
  "border-b-2 border-transparent py-2 text-sm font-semibold text-text-muted hover:text-text-primary";
const FILTER_ACTIVE = "border-b-brand text-text-primary";

/**
 * 관리자 방 관리 (HODL-78). 방을 찾아서 열고 닫는다.
 *
 * - 검색어 · 필터 · 쪽은 주소에 싣는다. 새로고침 · 뒤로 가기에도 그대로다.
 * - 닫기는 확인 창을 거친다. 닫는 즉시 그 방 글이 모든 사용자에게서 사라진다.
 *   열기는 되돌리기 쉬워서 바로 한다.
 * - 비활성 코인은 열어도 사용자 화면에 나오지 않아 열기를 막는다. 닫기는 된다.
 * - 실패는 토스트로 알린다(행동 실패 안내 규칙).
 */
export default function RoomManager({ q, status, page }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(q);
  const [closing, setClosing] = useState<AdminRoom | null>(null);
  const cancelClose = useCallback(() => setClosing(null), []);

  // 뒤로 가기로 검색어가 바뀌면 입력칸도 따라간다. 렌더 중에 맞춘다(effect 로 하면 한 번 더 그린다).
  const [shownQ, setShownQ] = useState(q);
  if (shownQ !== q) {
    setShownQ(q);
    setDraft(q);
  }

  const rooms = useQuery({
    queryKey: ["admin", "rooms", q, status, page],
    queryFn: () => loadAdminRooms({ q, status, page }),
    placeholderData: keepPreviousData,
  });

  const change = useMutation({
    mutationFn: ({ room, next }: { room: AdminRoom; next: RoomOperationStatus }) =>
      setRoomStatus(room.symbol, next),
    onSuccess: (_, { room, next }) => {
      setClosing(null);
      toast.success(`${room.name} 방을 ${next === "OPEN" ? "열었습니다" : "닫았습니다"}.`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "rooms"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.status === 403
          ? "관리자 권한이 없어 바꾸지 못했습니다."
          : "방 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    },
  });

  const search = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(adminRoomsHref({ q: draft, status }));
  };

  const pendingSymbol = change.isPending ? change.variables.room.symbol : null;
  const data = rooms.data;

  return (
    <section aria-labelledby="admin-rooms-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="admin-rooms-title" className="text-h2 font-semibold">
            방 관리
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            닫힌 방은 사용자 화면에서 숨겨집니다. 글은 지워지지 않고, 다시 열면 그대로 보입니다.
          </p>
        </div>

        <form role="search" onSubmit={search} className="flex gap-2">
          <label htmlFor="admin-room-q" className="sr-only">
            방 이름 · 심볼 검색
          </label>
          <input
            id="admin-room-q"
            type="search"
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="이름 · 심볼"
            className="w-44 rounded-sm border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-text-muted"
          />
          <Button type="submit">검색</Button>
        </form>
      </div>

      <nav aria-label="방 상태" className="flex gap-6 border-b border-border-subtle">
        {FILTERS.map((filter) => {
          const active = filter.value === status;
          return (
            <Link
              key={filter.label}
              href={adminRoomsHref({ q, status: filter.value })}
              aria-current={active ? "page" : undefined}
              className={`${FILTER_CLASS} ${active ? FILTER_ACTIVE : ""}`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {rooms.isPending ? (
        <p className="py-8 text-center text-sm text-text-muted">불러오는 중…</p>
      ) : rooms.isError || !data ? (
        <p className="py-8 text-center text-sm text-text-muted">
          방 목록을 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void rooms.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : data.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          {q ? `'${q}' 에 맞는 방이 없습니다.` : "방이 없습니다."}
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">방 {data.totalElements}개</p>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
            {data.items.map((room) => (
              <RoomRow
                key={room.id}
                room={room}
                pending={pendingSymbol === room.symbol}
                disabled={change.isPending}
                onOpen={() => change.mutate({ room, next: "OPEN" })}
                onClose={() => setClosing(room)}
              />
            ))}
          </ul>
          <PageLinks
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(target) => adminRoomsHref({ q, status, page: target })}
          />
        </>
      )}

      {closing ? (
        <CloseConfirm
          room={closing}
          busy={change.isPending}
          onCancel={cancelClose}
          onConfirm={() => change.mutate({ room: closing, next: "CLOSE" })}
        />
      ) : null}
    </section>
  );
}

function RoomRow({
  room,
  pending,
  disabled,
  onOpen,
  onClose,
}: {
  room: AdminRoom;
  pending: boolean;
  disabled: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const open = room.operationStatus === "OPEN";

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="w-14 flex-none font-semibold tabular-nums">{room.symbol}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{room.name}</span>

      {room.active ? null : (
        <span
          title="코인 목록에서 빠진 코인입니다. 방을 열어도 사용자 화면에 나오지 않습니다."
          className="flex-none rounded-sm border border-border-subtle px-1.5 py-0.5 text-xs text-text-muted"
        >
          비활성
        </span>
      )}

      <span
        className={`w-12 flex-none text-center text-xs font-semibold ${
          open ? "text-success" : "text-text-subtle"
        }`}
      >
        {open ? "열림" : "닫힘"}
      </span>

      {open ? (
        <Button type="button" className="w-20 flex-none" onClick={onClose} disabled={disabled}>
          {pending ? "닫는 중…" : "닫기"}
        </Button>
      ) : (
        // 닫힌 방이 대부분이라 브랜드 면 버튼으로 두면 목록이 보라색으로 뒤덮인다. 글자색만 준다.
        <Button
          type="button"
          className="w-20 flex-none text-brand"
          onClick={onOpen}
          disabled={disabled || !room.active}
        >
          {pending ? "여는 중…" : "열기"}
        </Button>
      )}
    </li>
  );
}

/**
 * 닫기 확인 창. 글 삭제 확인과 같은 모양으로 화면 전체를 흐리게 덮는다.
 * 실수로 Enter 를 눌러도 닫히지 않게 "취소" 에 포커스를 둔다. Esc · 바깥을 누르면 취소다.
 */
function CloseConfirm({
  room,
  busy,
  onCancel,
  onConfirm,
}: {
  room: AdminRoom;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButton.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-surface/60 px-4 pt-32 backdrop-blur-sm"
      onClick={() => (busy ? undefined : onCancel())}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="room-close-title"
        aria-describedby="room-close-desc"
        className="w-full max-w-sm rounded-lg border border-border-subtle bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="room-close-title" className="text-h2 font-semibold text-text-primary">
          {room.name}({room.symbol}) 방을 닫을까요?
        </h2>
        <div id="room-close-desc" className="mt-2 flex flex-col gap-1 text-sm text-text-muted">
          <p>닫는 즉시 모든 사용자에게서 이 방과 방의 글이 사라집니다.</p>
          <p>글은 지워지지 않고 보존되며, 다시 열면 그대로 돌아옵니다.</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelButton} type="button" onClick={onCancel} disabled={busy}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-danger hover:bg-danger/90"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "닫는 중…" : "닫기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
