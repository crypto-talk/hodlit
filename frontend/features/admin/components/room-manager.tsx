"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeRoomStatus,
  createRoom,
  deleteCategory,
  deleteRoom,
  loadAdminRooms,
  loadCategories,
  saveCategory,
  updateRoom,
} from "../api";
import type { AdminRoom } from "../types";
import BadgeEditor from "./badge-editor";

type Props = { q: string; page: number; navigate: (q: string, page: number) => void };

export default function RoomManager({ q, page, navigate }: Props) {
  const client = useQueryClient();
  const [badgeRoom, setBadgeRoom] = useState<string | null>(null);
  const rooms = useQuery({
    queryKey: ["admin-rooms", q, page],
    queryFn: () => loadAdminRooms(q, page),
  });
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: loadCategories });
  const action = useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin-rooms"] });
      await client.invalidateQueries({ queryKey: ["admin-categories"] });
      await client.invalidateQueries({ queryKey: ["rooms"] });
      await client.invalidateQueries({ queryKey: ["room"] });
    },
  });

  function saveRoom(form: HTMLFormElement, room?: AdminRoom) {
    const data = new FormData(form);
    const body = {
      name: String(data.get("name")),
      displayOrder: Number(data.get("order")),
      categoryId: data.get("category") ? Number(data.get("category")) : null,
    };
    action.mutate(() =>
      room
        ? updateRoom({ ...room, ...body, active: data.get("active") === "on" })
        : createRoom({ ...body, symbol: String(data.get("symbol")) }),
    );
  }

  return (
    <section className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(String(new FormData(e.currentTarget).get("q")), 0);
        }}
        className="flex gap-2"
      >
        <input
          name="q"
          aria-label="방 검색"
          defaultValue={q}
          maxLength={100}
          className="rounded border p-2"
        />
        <button type="submit">검색</button>
      </form>
      {action.isError && <p role="alert">{action.error.message}</p>}
      {action.isSuccess && <p role="status">설정을 저장했습니다.</p>}
      <details className="rounded border border-border-subtle p-4">
        <summary>새 방 생성</summary>
        <form
          className="mt-4 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveRoom(e.currentTarget);
          }}
        >
          <label>
            심볼{" "}
            <input
              name="symbol"
              required
              pattern="[A-Za-z0-9]{2,20}"
              maxLength={20}
              className="w-28 border p-2"
            />
          </label>
          <label>
            이름 <input name="name" required maxLength={80} className="border p-2" />
          </label>
          <label>
            순서{" "}
            <input
              name="order"
              type="number"
              min={0}
              defaultValue={0}
              required
              className="w-20 border p-2"
            />
          </label>
          <label>
            카테고리{" "}
            <select name="category" className="border p-2">
              <option value="">미분류</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={action.isPending}>공사 중으로 생성</button>
        </form>
      </details>
      {rooms.isPending ? (
        <p>방 목록 불러오는 중…</p>
      ) : rooms.isError ? (
        <button onClick={() => rooms.refetch()}>목록 재시도</button>
      ) : (
        <>
          <p>{rooms.data.totalElements}개 방</p>
          <ul className="space-y-3">
            {rooms.data.items.map((room) => (
              <li key={room.id} className="rounded border border-border-subtle p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <b>
                    {room.name} · {room.symbol}
                  </b>
                  <span>
                    {!room.active
                      ? "비활성"
                      : room.operationStatus === "OPEN"
                        ? "운영 중"
                        : "공사 중"}
                  </span>
                  <button
                    disabled={!room.active || action.isPending}
                    onClick={() => {
                      if (confirm(`${room.symbol} 방 상태를 변경할까요?`))
                        action.mutate(() =>
                          changeRoomStatus(
                            room.symbol,
                            room.operationStatus === "OPEN" ? "CLOSE" : "OPEN",
                          ),
                        );
                    }}
                  >
                    상태 변경
                  </button>
                  <button onClick={() => setBadgeRoom(room.symbol)}>등급 설정</button>
                  <button
                    disabled={action.isPending || !room.active}
                    onClick={() => {
                      if (confirm("방을 비활성화할까요? 기존 글·댓글은 보존됩니다."))
                        action.mutate(() => deleteRoom(room.symbol));
                    }}
                  >
                    방 삭제
                  </button>
                </div>
                <details className="mt-3">
                  <summary>방 정보 수정</summary>
                  <form
                    className="mt-2 flex flex-wrap gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveRoom(e.currentTarget, room);
                    }}
                  >
                    <label>
                      이름{" "}
                      <input
                        name="name"
                        defaultValue={room.name}
                        required
                        maxLength={80}
                        className="border p-2"
                      />
                    </label>
                    <label>
                      순서{" "}
                      <input
                        name="order"
                        type="number"
                        min={0}
                        defaultValue={room.displayOrder}
                        required
                        className="w-20 border p-2"
                      />
                    </label>
                    <label>
                      카테고리{" "}
                      <select
                        name="category"
                        defaultValue={room.categoryId ?? ""}
                        className="border p-2"
                      >
                        <option value="">미분류</option>
                        {categories.data?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <input name="active" type="checkbox" defaultChecked={room.active} /> 활성
                    </label>
                    <button disabled={action.isPending}>저장</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
          {rooms.data.items.length === 0 && <p>검색 결과가 없습니다.</p>}
          <div className="flex gap-4">
            <button disabled={page === 0} onClick={() => navigate(q, page - 1)}>
              이전
            </button>
            <span>
              {page + 1} / {Math.max(1, rooms.data.totalPages)}
            </span>
            <button
              disabled={page + 1 >= rooms.data.totalPages}
              onClick={() => navigate(q, page + 1)}
            >
              다음
            </button>
          </div>
        </>
      )}
      <details className="rounded border border-border-subtle p-4">
        <summary>방 카테고리 관리</summary>
        {categories.isError && (
          <button onClick={() => categories.refetch()}>카테고리 재시도</button>
        )}
        {[...(categories.data ?? []), { id: 0, name: "", displayOrder: 0 }].map((c) => (
          <form
            key={c.id}
            className="mt-3 flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              action.mutate(() =>
                saveCategory(c.id || null, String(data.get("name")), Number(data.get("order"))),
              );
            }}
          >
            <label>
              이름{" "}
              <input
                name="name"
                aria-label={c.id ? `${c.name} 이름` : "새 카테고리 이름"}
                defaultValue={c.name}
                required
                maxLength={80}
                className="border p-2"
              />
            </label>
            <label>
              순서{" "}
              <input
                name="order"
                type="number"
                min={0}
                defaultValue={c.displayOrder}
                required
                className="w-20 border p-2"
              />
            </label>
            <button disabled={action.isPending}>{c.id ? "수정" : "생성"}</button>
            {!!c.id && (
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => {
                  if (confirm("카테고리를 삭제할까요? 연결된 방이 있으면 먼저 이동해야 합니다."))
                    action.mutate(() => deleteCategory(c.id));
                }}
              >
                삭제
              </button>
            )}
          </form>
        ))}
      </details>
      {badgeRoom && (
        <BadgeEditor key={badgeRoom} symbol={badgeRoom} close={() => setBadgeRoom(null)} />
      )}
    </section>
  );
}
