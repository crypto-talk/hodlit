"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { deleteRoom, loadCategories, updateRoom } from "../api";
import type { AdminRoom } from "../types";
import BadgeEditor from "./badge-editor";

const LABEL = "text-xs font-semibold text-text-muted";

/**
 * 방 한 개의 설정 — 방 정보(이름 · 순서 · 카테고리 · 활성), 방 삭제, 보유 등급.
 *
 * 방 목록에서 "설정"을 누른 줄 바로 아래에 펼쳐진다(아코디언). 내용이 화면 두세 개
 * 길이라 모달로 띄우면 모달 안에서 또 스크롤해야 해서 줄 아래에 둔다.
 */
export default function RoomSettings({ room, close }: { room: AdminRoom; close: () => void }) {
  const client = useQueryClient();
  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: loadCategories });
  const [deleting, setDeleting] = useState(false);

  const done = async () => {
    await client.invalidateQueries({ queryKey: ["admin", "rooms"] });
    await client.invalidateQueries({ queryKey: ["room"] });
    await client.invalidateQueries({ queryKey: ["open-rooms"] });
  };

  const save = useMutation({
    mutationFn: (next: AdminRoom) => updateRoom(next),
    onSuccess: async (_, next) => {
      toast.success(`${next.name} 방 정보를 저장했습니다.`);
      await done();
    },
    onError: (error) => {
      toast.error(error.message || "방 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteRoom(room.symbol),
    onSuccess: async () => {
      setDeleting(false);
      toast.success(`${room.name} 방을 삭제했습니다.`);
      close();
      await done();
    },
    onError: (error) => {
      setDeleting(false);
      toast.error(error.message || "방을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });

  const busy = save.isPending || remove.isPending;

  return (
    <div
      id={`room-settings-${room.symbol}`}
      className="flex flex-col gap-5 border-t border-border-subtle bg-surface-muted/50 px-4 py-5"
    >
      {categories.isError ? (
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
      ) : !categories.data ? (
        <p className="text-sm text-text-muted">불러오는 중…</p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            save.mutate({
              ...room,
              name: String(data.get("name")),
              displayOrder: Number(data.get("order")),
              categoryId: data.get("category") ? Number(data.get("category")) : null,
              active: data.get("active") === "on",
            });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>이름</span>
            <Input
              name="name"
              defaultValue={room.catalogName ?? room.name}
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
              defaultValue={room.displayOrder}
              required
              className="w-20 tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>카테고리</span>
            <NativeSelect name="category" defaultValue={room.categoryId ?? ""} className="w-36">
              <option value="">미분류</option>
              {categories.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex h-10 items-center gap-2 text-sm text-text-primary">
            <input
              name="active"
              type="checkbox"
              defaultChecked={room.active}
              className="size-4 accent-brand"
            />
            활성
          </label>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              className="text-danger hover:border-danger"
              disabled={busy || !room.active}
              onClick={() => setDeleting(true)}
            >
              방 삭제
            </Button>
            <Button variant="primary" disabled={busy}>
              {save.isPending ? "저장 중…" : "방 정보 저장"}
            </Button>
          </div>
        </form>
      )}

      {room.active ? (
        <BadgeEditor symbol={room.symbol} />
      ) : (
        <p className="border-t border-border-subtle pt-5 text-sm text-text-muted">
          비활성 방은 방 정보를 저장해 활성화한 뒤 등급을 설정할 수 있습니다.
        </p>
      )}

      {deleting ? (
        <ConfirmDialog
          title={`${room.name}(${room.symbol}) 방을 삭제할까요?`}
          confirmLabel="삭제"
          busy={remove.isPending}
          onCancel={() => setDeleting(false)}
          onConfirm={() => remove.mutate()}
        >
          <p>방이 비활성화되어 목록과 사용자 화면에서 빠집니다.</p>
          <p>기존 글·댓글은 보존됩니다.</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
