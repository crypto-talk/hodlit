"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { coinNameKo } from "@/lib/coin-name-ko";
import { ApiError } from "@/lib/http";
import { editHref, postHref } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { loadEditablePost, updatePost } from "../api";
import { useImageUploads } from "../hooks/use-image-uploads";
import { CONTENT_MAX, TITLE_MAX, draftProblem } from "../limits";
import type { EditablePost } from "../types";
import BodyEditor from "./body-editor";
import CharCounter from "./char-counter";
import ImageAttachments from "./image-attachments";
import YoutubeField from "./youtube-field";

type Props = {
  postId: number;
  /** 주소의 방. 글을 받기 전 로그인 이동 주소에만 쓴다. */
  symbol: string;
};

const FIELD =
  "w-full rounded-sm border border-border-subtle bg-canvas px-3 text-text-primary focus:-outline-offset-1 focus:outline-2 focus:outline-brand";

/**
 * 글 수정 — 글쓰기와 같은 에디터에 원래 값을 채운다.
 *
 * 바꿀 수 있는 것: 제목 · 본문 · 이미지 · 유튜브 링크.
 * 바꿀 수 없는 것: 방, 그리고 발행 순간 고정된 보유 정보 · 작성 시점 가격.
 *
 * 작성자가 아니면 폼을 그리지 않는다. 서버도 403 으로 막는다(`PostService.own`).
 */
export default function EditForm({ postId, symbol }: Props) {
  const router = useRouter();
  const { member, restored } = useSession();

  const loggedOut = restored && !member;
  useEffect(() => {
    if (!loggedOut) return;
    router.replace(`/login?next=${encodeURIComponent(editHref(symbol, postId))}`);
  }, [loggedOut, postId, symbol, router]);

  // 수정 화면에 들어올 때마다 새로 받는다. 상세의 캐시와 섞이지 않게 키를 따로 쓴다.
  const post = useQuery({
    queryKey: ["post-edit", postId],
    queryFn: () => loadEditablePost(postId),
    gcTime: 0,
  });

  if (!restored || loggedOut || post.isPending) {
    return <p className="text-sm text-text-muted">불러오는 중…</p>;
  }

  if (post.isError) {
    const missing = post.error instanceof ApiError && post.error.status === 404;
    return (
      <Notice
        message={missing ? "글을 찾을 수 없습니다." : "글을 불러오지 못했습니다."}
        onRetry={missing ? undefined : () => post.refetch()}
      />
    );
  }

  if (post.data.authorId !== member?.id) {
    return (
      <Notice
        message="내가 쓴 글만 수정할 수 있습니다."
        back={postHref(post.data.coinSymbol || symbol, postId)}
      />
    );
  }

  return <EditFields post={post.data} />;
}

/**
 * 원래 값을 받은 뒤에만 그린다. 에디터와 이미지 훅이 처음 값을 마운트 때 한 번만
 * 읽기 때문이다.
 */
function EditFields({ post }: { post: EditablePost }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [youtubeUrl, setYoutubeUrl] = useState(post.youtubeUrl);
  const images = useImageUploads(post.images);
  const [problem, setProblem] = useState("");
  const room = post.coinSymbol;
  const back = postHref(room, post.id);

  const save = useMutation({
    mutationFn: updatePost,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["post", post.id] });
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      // 뒤로가기로 수정 화면에 돌아오지 않도록 replace 한다.
      router.replace(back);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = draftProblem({ coinSymbol: room, title, content, youtubeUrl });
    setProblem(found ?? "");
    if (found) return;
    save.mutate({
      id: post.id,
      title,
      content,
      youtubeUrl,
      images: images.uploaded,
      tradingView: post.tradingView,
    });
  };

  const pending = save.isPending || save.isSuccess;
  const errorMessage = problem || (save.error ? saveErrorMessage(save.error) : "");

  return (
    <form className="w-full max-w-180" onSubmit={submit} noValidate>
      <div className="flex items-center gap-4">
        <h1 className="text-h2 font-semibold">글 수정</h1>
        <div className="flex-1" />
        <Button type="button" onClick={() => router.back()} disabled={pending}>
          취소
        </Button>
        <Button type="submit" variant="primary" disabled={pending || images.uploading}>
          {pending ? "저장 중…" : images.uploading ? "업로드 중…" : "저장"}
        </Button>
      </div>

      <p className="mt-6 text-sm text-text-muted">
        <b className="font-semibold text-text-primary">
          {room} · {coinNameKo(room, room)}
        </b>{" "}
        방의 글입니다. 방은 바꿀 수 없습니다.
      </p>

      <input
        className={`${FIELD} mt-6 h-12 text-h2`}
        aria-label="제목"
        placeholder="제목"
        value={title}
        maxLength={TITLE_MAX}
        onChange={(event) => setTitle(event.target.value)}
      />
      <CharCounter length={title.length} max={TITLE_MAX} />

      <BodyEditor onChange={setContent} disabled={pending} initialContent={post.content} />
      <CharCounter length={content.length} max={CONTENT_MAX} />

      <ImageAttachments
        items={images.items}
        notice={images.notice}
        full={images.full}
        disabled={pending}
        onAdd={images.add}
        onRemove={images.remove}
      />

      <YoutubeField value={youtubeUrl} onChange={setYoutubeUrl} disabled={pending} />

      {errorMessage ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 rounded-sm border border-border-subtle bg-surface p-4 text-sm text-text-muted">
        <p>
          보유 정보와 작성 시점 가격은{" "}
          <b className="font-semibold text-text-primary">발행 시점 그대로</b> 남습니다. 수정한
          글에는 &quot;수정됨&quot; 이 붙습니다.
        </p>
      </div>
    </form>
  );
}

function Notice({
  message,
  onRetry,
  back,
}: {
  message: string;
  onRetry?: () => void;
  back?: string;
}) {
  return (
    <div className="w-full max-w-180 rounded-lg border border-border-subtle bg-surface p-6 text-center">
      <p className="text-body font-semibold">{message}</p>
      {onRetry ? (
        <button type="button" className="mt-4 text-sm font-semibold text-brand" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
      {back ? (
        <Link href={back} className="mt-4 inline-block text-sm font-semibold text-brand">
          글로 돌아가기
        </Link>
      ) : null}
    </div>
  );
}

/** 에러 code 목록은 아직 합의 전이라(C-5) 상태 코드로만 나눈다. */
function saveErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 만료됐습니다. 다시 로그인해 주세요.";
    if (error.status === 403) return "내가 쓴 글만 수정할 수 있습니다.";
    if (error.status === 404) return "글이 삭제됐거나 찾을 수 없습니다.";
    return error.message;
  }
  return "저장하지 못했습니다. 네트워크 상태를 확인해 주세요.";
}
