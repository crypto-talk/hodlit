"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createRoom, deleteCategory, loadCategories, saveCategory } from "../api";

const CARD = "rounded-lg border border-border-subtle bg-surface";
const SUMMARY =
  "flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold text-text-primary [&::-webkit-details-marker]:hidden";
const LABEL = "text-xs font-semibold text-text-muted";

type Work = { run: () => Promise<unknown>; success: string };

/** 삭제처럼 확인을 거치는 동작. 확인 창에 보일 문구와 실행할 일을 함께 둔다. */
type Pending = Work & { title: string; body: string; label: string };

/**
 * 방 목록 아래의 카탈로그 도구 — 새 방 생성, 방 카테고리 관리.
 * 방 한 개의 설정은 목록 줄 아래에 펼쳐지는 `room-settings.tsx` 에 있다.
 */
export default function RoomCatalogTools() {
  const client = useQueryClient();
  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: loadCategories });
  const [pending, setPending] = useState<Pending | null>(null);
  const action = useMutation({
    mutationFn: (work: Work) => work.run(),
    onSuccess: async (_, work) => {
      setPending(null);
      toast.success(work.success);
      await client.invalidateQueries({ queryKey: ["admin", "rooms"] });
      await client.invalidateQueries({ queryKey: ["admin", "categories"] });
      await client.invalidateQueries({ queryKey: ["room"] });
      await client.invalidateQueries({ queryKey: ["open-rooms"] });
    },
    onError: (error) => {
      setPending(null);
      toast.error(error.message || "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    },
  });

  function createFrom(form: HTMLFormElement) {
    const data = new FormData(form);
    const fields = {
      name: String(data.get("name")),
      displayOrder: Number(data.get("order")),
      categoryId: data.get("category") ? Number(data.get("category")) : null,
    };
    action.mutate({
      run: () => createRoom({ ...fields, symbol: String(data.get("symbol")) }),
      success: `${fields.name} 방을 공사 중으로 만들었습니다.`,
    });
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
            createFrom(e.currentTarget);
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
                  const name = String(data.get("name"));
                  action.mutate({
                    run: () => saveCategory(c.id || null, name, Number(data.get("order"))),
                    success: c.id
                      ? `${name} 카테고리를 수정했습니다.`
                      : `${name} 카테고리를 만들었습니다.`,
                  });
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
                      onClick={() =>
                        setPending({
                          title: `${c.name} 카테고리를 삭제할까요?`,
                          body: "연결된 방이 있으면 삭제되지 않습니다. 먼저 다른 카테고리나 미분류로 옮겨 주세요.",
                          label: "삭제",
                          run: () => deleteCategory(c.id),
                          success: `${c.name} 카테고리를 삭제했습니다.`,
                        })
                      }
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

      {pending ? (
        <ConfirmDialog
          title={pending.title}
          confirmLabel={pending.label}
          busy={action.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => action.mutate(pending)}
        >
          <p>{pending.body}</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
