"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { createBanner, deleteBanner, loadBanners, reorderBanners, updateBanner } from "../api";
import { adminErrorMessage } from "../error-message";
import type { AdminBanner, BannerInput } from "../types";
import BannerForm from "./banner-form";

/**
 * 관리자 배너 관리 (HODL-92). 등록 · 수정 · 삭제, 노출 여부, 순서.
 *
 * - 사용자 화면에는 "노출" 인 배너만 여기 순서대로 나간다. 서버가 배너 응답을 따로 쥐고 있지
 *   않아서, 저장하면 사용자가 다음에 화면을 열 때 바로 반영된다
 * - 순서는 위 · 아래 버튼으로 옮기고, 옮길 때마다 전체 순서를 서버에 저장한다
 * - 삭제는 확인 창을 거친다. 배너를 지워도 올린 이미지 파일은 서버에 남는다
 */
export default function BannerManager() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<AdminBanner | null>(null);
  const cancelRemove = useCallback(() => setRemoving(null), []);

  const banners = useQuery({ queryKey: ["admin", "banners"], queryFn: loadBanners });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
    // 사용자 화면의 배너 칸이 쥐고 있던 목록도 버린다.
    void queryClient.invalidateQueries({ queryKey: ["banners"] });
  };

  const list = banners.data ?? [];
  /** 새 배너는 맨 뒤에 붙인다. */
  const nextOrder = list.reduce((max, banner) => Math.max(max, banner.displayOrder + 1), 0);

  const create = useMutation({
    mutationFn: (input: BannerInput) => createBanner(input, nextOrder),
    onSuccess: () => {
      setAdding(false);
      toast.success("배너를 등록했습니다.");
      refresh();
    },
    onError: (error) => toast.error(adminErrorMessage(error, "배너를 등록하지 못했습니다.")),
  });
  const update = useMutation({
    mutationFn: ({ banner, input }: { banner: AdminBanner; input: BannerInput }) =>
      updateBanner(banner.id, input, banner.displayOrder),
    onSuccess: (_, { input }) => {
      setEditing(null);
      toast.success(
        input.visible ? "배너를 저장했습니다." : "배너를 저장했습니다. 지금은 숨김입니다.",
      );
      refresh();
    },
    onError: (error) => toast.error(adminErrorMessage(error, "배너를 저장하지 못했습니다.")),
  });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => reorderBanners(ids),
    onSuccess: () => {
      toast.success("순서를 저장했습니다.");
      refresh();
    },
    onError: (error) => {
      toast.error(adminErrorMessage(error, "순서를 저장하지 못했습니다."));
      // 누가 그 사이 배너를 더하거나 지웠을 수 있다. 목록을 다시 받는다.
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (banner: AdminBanner) => deleteBanner(banner.id),
    onSuccess: () => {
      setRemoving(null);
      toast.success("배너를 지웠습니다.");
      refresh();
    },
    onError: (error) => {
      setRemoving(null);
      toast.error(adminErrorMessage(error, "배너를 지우지 못했습니다."));
    },
  });

  const move = (index: number, offset: number) => {
    const ids = list.map((banner) => banner.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    reorder.mutate(ids);
  };

  const working = create.isPending || update.isPending || reorder.isPending || remove.isPending;

  return (
    <section aria-labelledby="admin-banners-title" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-banners-title" className="text-h2 font-semibold">
          배너 관리
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          홈 화면 위쪽에 보이는 배너입니다. 노출로 둔 배너만 아래 순서대로 사용자에게 보입니다.
        </p>
      </div>

      {adding ? (
        <div className="rounded-lg border border-border-subtle bg-surface p-4">
          <h3 className="mb-4 font-semibold text-text-primary">배너 등록</h3>
          <BannerForm
            submitLabel="등록"
            busy={create.isPending}
            onSubmit={(input) => create.mutate(input)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <div>
          <Button type="button" variant="primary" onClick={() => setAdding(true)}>
            배너 등록
          </Button>
        </div>
      )}

      {banners.isPending ? (
        <p className="py-8 text-center text-sm text-text-muted">불러오는 중…</p>
      ) : banners.isError ? (
        <p className="py-8 text-center text-sm text-text-muted">
          배너 목록을 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void banners.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          등록된 배너가 없습니다. 사용자 화면에는 배너 칸이 보이지 않습니다.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            배너 {list.length}개 · 노출 {list.filter((banner) => banner.visible).length}개
          </p>
          <ol className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
            {list.map((banner, index) => (
              <li key={banner.id} className="p-4">
                {editing === banner.id ? (
                  <BannerForm
                    initial={banner}
                    submitLabel="저장"
                    busy={update.isPending}
                    onSubmit={(input) => update.mutate({ banner, input })}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <BannerRow
                    banner={banner}
                    position={index + 1}
                    first={index === 0}
                    last={index === list.length - 1}
                    disabled={working}
                    onUp={() => move(index, -1)}
                    onDown={() => move(index, 1)}
                    onEdit={() => setEditing(banner.id)}
                    onRemove={() => setRemoving(banner)}
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {removing ? (
        <ConfirmDialog
          title="이 배너를 지울까요?"
          confirmLabel="지우기"
          busyLabel="지우는 중…"
          busy={remove.isPending}
          onCancel={cancelRemove}
          onConfirm={() => remove.mutate(removing)}
        >
          <p className="break-words">{removing.title}</p>
          <p>지우면 되돌릴 수 없습니다. 잠깐 내리려면 수정에서 노출을 끄면 됩니다.</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

function BannerRow({
  banner,
  position,
  first,
  last,
  disabled,
  onUp,
  onDown,
  onEdit,
  onRemove,
}: {
  banner: AdminBanner;
  position: number;
  first: boolean;
  last: boolean;
  disabled: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-6 flex-none text-center text-sm text-text-muted tabular-nums">
        {position}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버의 원본. next/image 원격 설정 전 */}
      <img
        src={banner.imageSrc}
        alt={banner.altText}
        className="h-12 w-28 flex-none rounded-sm border border-border-subtle bg-canvas object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{banner.title}</p>
        <p className="truncate text-xs text-text-muted">
          {banner.linkUrl ? banner.linkUrl : "링크 없음"}
        </p>
      </div>
      <span
        className={`flex-none text-xs font-semibold ${banner.visible ? "text-success" : "text-text-subtle"}`}
      >
        {banner.visible ? "노출" : "숨김"}
      </span>
      <div className="flex flex-none gap-1">
        <Button
          type="button"
          className="size-9 px-0 py-0"
          aria-label={`${banner.title} 위로`}
          disabled={disabled || first}
          onClick={onUp}
        >
          <ChevronUp />
        </Button>
        <Button
          type="button"
          className="size-9 px-0 py-0"
          aria-label={`${banner.title} 아래로`}
          disabled={disabled || last}
          onClick={onDown}
        >
          <ChevronDown />
        </Button>
        <Button type="button" onClick={onEdit} disabled={disabled}>
          수정
        </Button>
        <Button
          type="button"
          className="text-danger hover:border-danger"
          onClick={onRemove}
          disabled={disabled}
        >
          삭제
        </Button>
      </div>
    </div>
  );
}
