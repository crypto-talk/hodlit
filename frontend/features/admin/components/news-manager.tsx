"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/confirm-dialog";
import PageLinks from "@/components/page-links";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/time";
import { ApiError } from "@/lib/http";
import { adminNewsHref } from "@/lib/routes";
import { safeExternalUrl } from "@/lib/safe-url";
import { createNews, deleteNews, loadAdminNews, updateNews } from "../api";
import { adminErrorMessage } from "../error-message";
import type { AdminNews, NewsInput } from "../types";
import NewsForm from "./news-form";
import RoomPicker from "./room-picker";

type Props = {
  room: string | null;
  /** 1부터. */
  page: number;
};

/**
 * 관리자 방 뉴스 관리 (HODL-110). 방을 고르고, 그 방의 뉴스를 등록 · 수정 · 삭제한다.
 *
 * - 목록은 사용자 화면과 같은 공개 조회다. 저장하면 다시 받아 오므로 여기 보이는 것이 곧
 *   사용자에게 보이는 것이다. 방 게시판의 뉴스 칸도 다음에 열 때 새로 받는다
 * - 고른 방과 쪽은 주소에 있다. 새로고침 · 뒤로 가기에도 그대로다
 * - 수정은 그 줄 아래에 폼이 펼쳐진다(한 번에 하나). 삭제는 확인 창을 거친다 — 되돌릴 수 없다
 * - 자동 수집 · 발행은 여기 없다(HODL-105 가 따로 한다)
 */
export default function NewsManager({ room, page }: Props) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<AdminNews | null>(null);
  const cancelRemove = useCallback(() => setRemoving(null), []);

  const news = useQuery({
    queryKey: ["admin", "news", room, page],
    queryFn: () => loadAdminNews(room ?? "", page),
    enabled: Boolean(room),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "news", room] });
    // 사용자 화면의 뉴스 칸 · 뉴스 페이지가 쥐고 있던 목록도 버린다.
    void queryClient.invalidateQueries({ queryKey: ["room-news"] });
  };

  const create = useMutation({
    mutationFn: (input: NewsInput) => createNews(room ?? "", input),
    onSuccess: () => {
      setAdding(false);
      toast.success("뉴스를 등록했습니다.");
      refresh();
    },
    onError: (error) => toast.error(adminErrorMessage(error, "뉴스를 등록하지 못했습니다.")),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: NewsInput }) => updateNews(id, input),
    onSuccess: () => {
      setEditing(null);
      toast.success("뉴스를 고쳤습니다.");
      refresh();
    },
    onError: (error) => toast.error(adminErrorMessage(error, "뉴스를 고치지 못했습니다.")),
  });
  const remove = useMutation({
    mutationFn: (item: AdminNews) => deleteNews(item.id),
    onSuccess: () => {
      setRemoving(null);
      toast.success("뉴스를 지웠습니다.");
      refresh();
    },
    onError: (error) => {
      setRemoving(null);
      toast.error(adminErrorMessage(error, "뉴스를 지우지 못했습니다."));
    },
  });

  const data = news.data;
  const closedRoom =
    news.error instanceof ApiError &&
    news.error.status === 403 &&
    news.error.code === "ROOM_CLOSED";

  return (
    <section aria-labelledby="admin-news-title" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-news-title" className="text-h2 font-semibold">
          뉴스 관리
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          방 게시판의 뉴스 칸에 보일 기사를 직접 등록합니다. 제목 · 짧은 요약 · 출처 · 원문 링크만
          보이고, 원문은 바깥 링크로 열립니다.
        </p>
      </div>

      <RoomPicker room={room} hrefFor={(symbol) => adminNewsHref({ room: symbol })} />

      {!room ? (
        <p className="py-8 text-center text-sm text-text-muted">뉴스를 관리할 방을 골라 주세요.</p>
      ) : (
        <>
          {adding ? (
            <div className="rounded-lg border border-border-subtle bg-surface p-4">
              <h3 className="mb-4 font-semibold text-text-primary">{room} 방 뉴스 등록</h3>
              <NewsForm
                submitLabel="등록"
                busy={create.isPending}
                onSubmit={(input) => create.mutate(input)}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <div>
              <Button type="button" variant="primary" onClick={() => setAdding(true)}>
                뉴스 등록
              </Button>
            </div>
          )}

          {news.isPending ? (
            <p className="py-8 text-center text-sm text-text-muted">불러오는 중…</p>
          ) : news.isError || !data ? (
            <p className="py-8 text-center text-sm text-text-muted">
              {closedRoom
                ? `${room} 방이 닫혀 있어 뉴스 목록을 볼 수 없습니다. 방을 연 뒤 다시 확인해 주세요. `
                : "뉴스 목록을 불러오지 못했습니다. "}
              <button
                type="button"
                className="text-brand hover:underline"
                onClick={() => void news.refetch()}
              >
                다시 시도
              </button>
            </p>
          ) : data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              {room} 방에 등록된 뉴스가 없습니다.
            </p>
          ) : (
            <>
              <p className="text-sm text-text-muted">뉴스 {data.totalElements}건 · 최신순</p>
              <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface">
                {data.items.map((item) => (
                  <li key={item.id} className="p-4">
                    {editing === item.id ? (
                      <NewsForm
                        initial={item}
                        submitLabel="저장"
                        busy={update.isPending}
                        onSubmit={(input) => update.mutate({ id: item.id, input })}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <NewsRow
                        item={item}
                        disabled={update.isPending || remove.isPending}
                        onEdit={() => setEditing(item.id)}
                        onRemove={() => setRemoving(item)}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <PageLinks
                page={data.page}
                totalPages={data.totalPages}
                hrefFor={(target) => adminNewsHref({ room, page: target })}
              />
            </>
          )}
        </>
      )}

      {removing ? (
        <ConfirmDialog
          title="이 뉴스를 지울까요?"
          confirmLabel="지우기"
          busyLabel="지우는 중…"
          busy={remove.isPending}
          onCancel={cancelRemove}
          onConfirm={() => remove.mutate(removing)}
        >
          <p className="break-words">{removing.title}</p>
          <p>지우면 되돌릴 수 없습니다.</p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

function NewsRow({
  item,
  disabled,
  onEdit,
  onRemove,
}: {
  item: AdminNews;
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const link = safeExternalUrl(item.sourceUrl);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 font-semibold break-words text-text-primary">{item.title}</p>
        <div className="flex flex-none gap-2">
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
      <p className="text-sm break-words whitespace-pre-line text-text-muted">{item.summary}</p>
      <p className="text-xs text-text-muted">
        출처 {item.sourceName} ·{" "}
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-brand hover:underline"
          >
            {item.sourceUrl}
          </a>
        ) : (
          // 저장된 주소가 링크로 쓸 수 없는 모양이면 글자로만 보인다. 사용자 화면도 링크를 걸지 않는다.
          <span className="break-all">{item.sourceUrl} (링크로 쓸 수 없는 주소)</span>
        )}
        {item.createdAt ? ` · ${formatDateTime(item.createdAt)} 등록` : ""}
      </p>
    </div>
  );
}
