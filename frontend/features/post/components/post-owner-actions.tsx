"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import { editHref, roomHref } from "@/lib/routes";
import { deletePost } from "../api";

type Props = {
  postId: number;
  room: string;
};

/**
 * 글쓴이에게만 보이는 수정 · 삭제. 보여줄지는 글 상세가 정하고, 검사는 서버가 한다.
 *
 * 삭제를 누르면 글 카드 위를 흐리게 덮고 확인 창을 띄운다. 브라우저 확인창은 쓰지
 * 않는다. 덮개는 가장 가까운 `relative` 조상(글 상세의 `<article>`)을 채운다.
 * Esc 나 바깥을 누르면 닫힌다.
 *
 * 지우면 그 방 게시판으로 간다 — 글 상세에 남아 있으면 404 만 보인다.
 */
export default function PostOwnerActions({ postId, room }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const cancelButton = useRef<HTMLButtonElement>(null);

  const remove = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      // 상세 쿼리를 무효화하면 지워진 글을 다시 받아 404 가 잠깐 보인다. 버리기만 한다.
      queryClient.removeQueries({ queryKey: ["post", postId] });
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      router.replace(roomHref(room));
    },
  });

  const busy = remove.isPending || remove.isSuccess;

  const close = () => {
    if (busy) return;
    setConfirming(false);
    remove.reset();
  };

  // 열리면 "취소" 에 포커스를 둔다. 실수로 Enter 를 눌러도 지워지지 않게.
  useEffect(() => {
    if (!confirming) return;
    cancelButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const error = remove.error
    ? remove.error instanceof ApiError && remove.error.status === 403
      ? "내가 쓴 글만 삭제할 수 있습니다."
      : "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요."
    : "";

  return (
    <>
      <span className="flex items-center gap-3 text-xs text-text-muted">
        <Link href={editHref(room, postId)} className="hover:text-text-primary">
          수정
        </Link>
        <button type="button" className="hover:text-danger" onClick={() => setConfirming(true)}>
          삭제
        </button>
      </span>

      {confirming ? (
        <div
          className="absolute inset-0 z-20 flex items-start justify-center rounded-lg bg-surface/60 px-4 pt-24 backdrop-blur-sm"
          onClick={close}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="post-delete-title"
            aria-describedby="post-delete-desc"
            className="w-full max-w-sm rounded-lg border border-border-subtle bg-surface p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="post-delete-title" className="text-h2 font-semibold text-text-primary">
              이 글을 삭제할까요?
            </h2>
            <p id="post-delete-desc" className="mt-2 text-sm text-text-muted">
              삭제하면 되돌릴 수 없습니다. 첨부한 이미지도 함께 지워집니다.
            </p>
            {error ? (
              <p role="alert" className="mt-4 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button ref={cancelButton} type="button" onClick={close} disabled={busy}>
                취소
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-danger hover:bg-danger/90"
                onClick={() => remove.mutate()}
                disabled={busy}
              >
                {busy ? "삭제 중…" : "삭제"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
