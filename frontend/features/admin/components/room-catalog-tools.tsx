"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRoom,
  deleteCategory,
  deleteRoom,
  loadCategories,
  saveCategory,
  updateRoom,
} from "../api";
import type { AdminRoom } from "../types";
import BadgeEditor from "./badge-editor";

/** Extends the existing room-status screen with catalog and badge settings. */
export default function RoomCatalogTools({
  selected,
  close,
}: {
  selected: AdminRoom | null;
  close: () => void;
}) {
  const client = useQueryClient();
  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: loadCategories });
  const action = useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin", "rooms"] });
      await client.invalidateQueries({ queryKey: ["admin", "categories"] });
      await client.invalidateQueries({ queryKey: ["room"] });
      await client.invalidateQueries({ queryKey: ["open-rooms"] });
      close();
    },
  });

  function saveRoom(form: HTMLFormElement, room?: AdminRoom) {
    const data = new FormData(form);
    const fields = {
      name: String(data.get("name")),
      displayOrder: Number(data.get("order")),
      categoryId: data.get("category") ? Number(data.get("category")) : null,
    };
    action.mutate(() =>
      room
        ? updateRoom({ ...room, ...fields, active: data.get("active") === "on" })
        : createRoom({ ...fields, symbol: String(data.get("symbol")) }),
    );
  }

  return (
    <div className="space-y-5">
      {action.isError && <p role="alert">{action.error.message}</p>}
      {action.isSuccess && <p role="status">설정을 저장했습니다.</p>}
      {categories.isError && (
        <button onClick={() => categories.refetch()}>카테고리 불러오기 재시도</button>
      )}
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
              className="w-28 border border-border-subtle p-2"
            />
          </label>
          <label>
            이름{" "}
            <input
              name="name"
              required
              maxLength={80}
              className="border border-border-subtle p-2"
            />
          </label>
          <label>
            순서{" "}
            <input
              name="order"
              type="number"
              min={0}
              defaultValue={0}
              required
              className="w-20 border border-border-subtle p-2"
            />
          </label>
          <label>
            카테고리{" "}
            <select name="category" className="border border-border-subtle p-2">
              <option value="">미분류</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={action.isPending || categories.isPending}>공사 중으로 생성</button>
        </form>
      </details>

      {selected && categories.data && (
        <section
          key={selected.id}
          className="space-y-4 rounded-lg border border-border-subtle bg-surface p-4"
          aria-label="방 상세 설정"
        >
          <div className="flex justify-between">
            <h2 className="font-semibold">
              {selected.name} · {selected.symbol} 설정
            </h2>
            <button onClick={close}>설정 닫기</button>
          </div>
          <form
            className="flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveRoom(e.currentTarget, selected);
            }}
          >
            <label>
              이름{" "}
              <input
                name="name"
                defaultValue={selected.catalogName ?? selected.name}
                required
                maxLength={80}
                className="border border-border-subtle p-2"
              />
            </label>
            <label>
              순서{" "}
              <input
                name="order"
                type="number"
                min={0}
                defaultValue={selected.displayOrder}
                required
                className="w-20 border border-border-subtle p-2"
              />
            </label>
            <label>
              카테고리{" "}
              <select
                name="category"
                defaultValue={selected.categoryId ?? ""}
                className="border border-border-subtle p-2"
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
              <input name="active" type="checkbox" defaultChecked={selected.active} /> 활성
            </label>
            <button disabled={action.isPending || categories.isPending}>방 정보 저장</button>
          </form>
          <button
            disabled={action.isPending || !selected.active}
            onClick={() => {
              if (confirm("방을 삭제할까요? 비활성화되며 기존 글·댓글은 보존됩니다."))
                action.mutate(() => deleteRoom(selected.symbol));
            }}
          >
            방 삭제
          </button>
          {selected.active ? (
            <BadgeEditor symbol={selected.symbol} close={close} />
          ) : (
            <p className="text-sm text-text-muted">
              비활성 방은 방 정보를 저장해 활성화한 뒤 등급을 설정할 수 있습니다.
            </p>
          )}
        </section>
      )}

      <details className="rounded border border-border-subtle p-4">
        <summary>방 카테고리 관리</summary>
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
                defaultValue={c.name}
                required
                maxLength={80}
                aria-label={c.id ? `${c.name} 이름` : "새 카테고리 이름"}
                className="border border-border-subtle p-2"
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
                className="w-20 border border-border-subtle p-2"
              />
            </label>
            <button disabled={action.isPending}>{c.id ? "수정" : "생성"}</button>
            {!!c.id && (
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => {
                  if (confirm("카테고리를 삭제할까요? 연결된 방은 먼저 이동해야 합니다."))
                    action.mutate(() => deleteCategory(c.id));
                }}
              >
                삭제
              </button>
            )}
          </form>
        ))}
      </details>
    </div>
  );
}
