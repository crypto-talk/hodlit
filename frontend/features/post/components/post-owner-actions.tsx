"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
 * 삭제는 브라우저 확인창 대신 그 자리에서 한 번 더 묻는다(댓글과 같은 방식).
 * 지우면 그 방 게시판으로 간다 — 글 상세에 남아 있으면 404 만 보인다.
 */
export default function PostOwnerActions({ postId, room }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      // 상세 쿼리를 무효화하면 지워진 글을 다시 받아 404 가 잠깐 보인다. 버리기만 한다.
      queryClient.removeQueries({ queryKey: ["post", postId] });
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      router.replace(roomHref(room));
    },
  });

  const error = remove.error
    ? remove.error instanceof ApiError && remove.error.status === 403
      ? "내가 쓴 글만 삭제할 수 있습니다."
      : "삭제하지 못했습니다."
    : "";

  if (confirming) {
    return (
      <span className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>이 글을 삭제할까요? 되돌릴 수 없습니다.</span>
        <button
          type="button"
          className="font-semibold text-danger"
          disabled={remove.isPending || remove.isSuccess}
          onClick={() => remove.mutate()}
        >
          {remove.isPending || remove.isSuccess ? "삭제 중…" : "삭제"}
        </button>
        <button
          type="button"
          disabled={remove.isPending || remove.isSuccess}
          onClick={() => {
            setConfirming(false);
            remove.reset();
          }}
        >
          취소
        </button>
        {error ? (
          <span role="alert" className="text-danger">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3 text-xs text-text-muted">
      <Link href={editHref(room, postId)} className="hover:text-text-primary">
        수정
      </Link>
      <button type="button" className="hover:text-danger" onClick={() => setConfirming(true)}>
        삭제
      </button>
    </span>
  );
}
