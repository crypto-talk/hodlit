"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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

const CARD = "rounded-lg border border-border-subtle bg-surface";
const SUMMARY =
  "flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold text-text-primary [&::-webkit-details-marker]:hidden";
const LABEL = "text-xs font-semibold text-text-muted";

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

  const categoryOptions = (
    <>
      <option value="">미분류</option>
      {categories.data?.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {action.isError && (
        <p role="alert" className="text-sm text-danger">
          {action.error.message}
        </p>
      )}
      {action.isSuccess && (
        <p role="status" className="text-sm text-success">
          설정을 저장했습니다.
        </p>
      )}
      {categories.isError && (
        <p className="text-sm text-text-muted">
          카테고리를 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void categories.refetch()}
          >
            다시 시도
          </button>
        </p>
      )}

      {selected && categories.data && (
        <section
          key={selected.id}
          className={`${CARD} flex flex-col gap-5 p-5`}
          aria-label="방 상세 설정"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-h2 font-semibold text-text-primary">
              {selected.name} · {selected.symbol} 설정
            </h2>
            <Button type="button" onClick={close} className="flex-none">
              설정 닫기
            </Button>
          </div>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveRoom(e.currentTarget, selected);
            }}
          >
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>이름</span>
              <Input
                name="name"
                defaultValue={selected.catalogName ?? selected.name}
                required
                maxLength={80}
                className="w-48"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>순서</span>
              <Input
                name="order"
                type="number"
                min={0}
                defaultValue={selected.displayOrder}
                required
                className="w-20 tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>카테고리</span>
              <NativeSelect
                name="category"
                defaultValue={selected.categoryId ?? ""}
                className="w-36"
              >
                {categoryOptions}
              </NativeSelect>
            </label>
            <label className="flex h-10 items-center gap-2 text-sm text-text-primary">
              <input
                name="active"
                type="checkbox"
                defaultChecked={selected.active}
                className="size-4 accent-brand"
              />
              활성
            </label>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                className="text-danger hover:border-danger"
                disabled={action.isPending || !selected.active}
                onClick={() => {
                  if (confirm("방을 삭제할까요? 비활성화되며 기존 글·댓글은 보존됩니다."))
                    action.mutate(() => deleteRoom(selected.symbol));
                }}
              >
                방 삭제
              </Button>
              <Button variant="primary" disabled={action.isPending || categories.isPending}>
                방 정보 저장
              </Button>
            </div>
          </form>
          {selected.active ? (
            <BadgeEditor symbol={selected.symbol} close={close} />
          ) : (
            <p className="border-t border-border-subtle pt-5 text-sm text-text-muted">
              비활성 방은 방 정보를 저장해 활성화한 뒤 등급을 설정할 수 있습니다.
            </p>
          )}
        </section>
      )}

      <details className={`${CARD} group`}>
        <summary className={SUMMARY}>
          <ChevronRight
            aria-hidden
            className="size-4 text-text-muted transition-transform group-open:rotate-90"
          />
          새 방 생성
        </summary>
        <form
          className="flex flex-wrap items-end gap-3 border-t border-border-subtle px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveRoom(e.currentTarget);
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>심볼</span>
            <Input
              name="symbol"
              required
              pattern="[A-Za-z0-9]{2,20}"
              maxLength={20}
              className="w-28 uppercase"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>이름</span>
            <Input name="name" required maxLength={80} className="w-48" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>순서</span>
            <Input
              name="order"
              type="number"
              min={0}
              defaultValue={0}
              required
              className="w-20 tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>카테고리</span>
            <NativeSelect name="category" className="w-36">
              {categoryOptions}
            </NativeSelect>
          </label>
          <Button
            variant="primary"
            className="ml-auto"
            disabled={action.isPending || categories.isPending}
          >
            공사 중으로 생성
          </Button>
        </form>
      </details>

      <details className={`${CARD} group`}>
        <summary className={SUMMARY}>
          <ChevronRight
            aria-hidden
            className="size-4 text-text-muted transition-transform group-open:rotate-90"
          />
          방 카테고리 관리
        </summary>
        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {[...(categories.data ?? []), { id: 0, name: "", displayOrder: 0 }].map((c) => (
            <li key={c.id} className="px-5 py-3">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  action.mutate(() =>
                    saveCategory(c.id || null, String(data.get("name")), Number(data.get("order"))),
                  );
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>{c.id ? "이름" : "새 카테고리"}</span>
                  <Input
                    name="name"
                    defaultValue={c.name}
                    required
                    maxLength={80}
                    aria-label={c.id ? `${c.name} 이름` : "새 카테고리 이름"}
                    className="w-48"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL}>순서</span>
                  <Input
                    name="order"
                    type="number"
                    min={0}
                    defaultValue={c.displayOrder}
                    required
                    className="w-20 tabular-nums"
                  />
                </label>
                <div className="ml-auto flex gap-2">
                  {!!c.id && (
                    <Button
                      type="button"
                      className="text-danger hover:border-danger"
                      disabled={action.isPending}
                      onClick={() => {
                        if (confirm("카테고리를 삭제할까요? 연결된 방은 먼저 이동해야 합니다."))
                          action.mutate(() => deleteCategory(c.id));
                      }}
                    >
                      삭제
                    </Button>
                  )}
                  <Button variant={c.id ? "secondary" : "primary"} disabled={action.isPending}>
                    {c.id ? "수정" : "생성"}
                  </Button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
