"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RoomClosedNotice from "@/components/room-closed-notice";
import { Button } from "@/components/ui/button";
import { coinNameKo } from "@/lib/coin-name-ko";
import { formatRelativeTime } from "@/lib/format/time";
import { ApiError } from "@/lib/http";
import { editHref, postHref } from "@/lib/routes";
import { isRoomClosedError } from "@/lib/room-status";
import { useSession } from "@/lib/session";
import { deleteDraft, loadEditDraft, loadEditablePost, saveEditDraft, updatePost } from "../api";
import { useImageUploads } from "../hooks/use-image-uploads";
import { useWriteRooms } from "../hooks/use-write-rooms";
import { CONTENT_MAX, TITLE_MAX, draftProblem } from "../limits";
import type { Draft, EditDraftInput, EditablePost } from "../types";
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

/** 에디터를 무엇으로 채워 시작했는지. 바꾸면 에디터를 새로 마운트한다. */
type Start = "draft" | "post";

/**
 * 글 수정 — 글쓰기와 같은 에디터에 원래 값을 채운다.
 *
 * 바꿀 수 있는 것: 제목 · 본문 · 이미지 · 유튜브 링크.
 * 바꿀 수 없는 것: 방, 그리고 발행 순간 고정된 보유 정보 · 작성 시점 가격.
 *
 * 작성자가 아니면 폼을 그리지 않는다. 서버도 403 으로 막는다(`PostService.own`).
 *
 * 임시저장(HODL-56): 글 하나에 하나, `/posts/{id}/draft`. 들어올 때 먼저 찾고, 있으면 그
 * 내용으로 시작한다(원래 글로 되돌릴 수 있다). 고치면 글쓰기와 같은 방식으로 자동저장하고,
 * 수정을 저장하면 지운다. 원래 글은 저장 버튼을 누르기 전까지 바뀌지 않는다.
 *
 * 닫힌 방(HODL-77)의 글은 원래 글부터 403 `ROOM_CLOSED` 로 막힌다. 닫힌 방 안내만 보인다.
 * 수정본 임시저장은 서버에 남아 있어 방이 다시 열리면 이어 고칠 수 있다.
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

  // 임시저장은 본인 글에만 있다. 글을 받아 작성자인 것을 확인한 뒤에 부른다 — 그래야
  // 404 가 "원래 글 없음" 이 아니라 "임시저장 없음" 이다(`loadEditDraft`).
  const isAuthor = !!member && post.data?.authorId === member.id;
  const draft = useQuery({
    queryKey: ["edit-draft", postId, member?.id ?? null],
    queryFn: () => loadEditDraft(postId),
    enabled: isAuthor,
    gcTime: 0,
  });

  if (!restored || loggedOut || post.isPending) {
    return <p className="text-sm text-text-muted">불러오는 중…</p>;
  }

  if (post.isError && isRoomClosedError(post.error)) {
    return <ClosedRoom symbol={symbol} />;
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

  if (!isAuthor) {
    return (
      <Notice
        message="내가 쓴 글만 수정할 수 있습니다."
        back={postHref(post.data.coinSymbol || symbol, postId)}
      />
    );
  }

  if (draft.isPending) return <p className="text-sm text-text-muted">불러오는 중…</p>;

  // 확인하지 못한 채 원래 글로 시작하면, 다음 자동저장이 남아 있던 수정본을 덮어쓴다.
  if (draft.isError) {
    return (
      <Notice message="임시저장한 수정본을 확인하지 못했습니다." onRetry={() => draft.refetch()} />
    );
  }

  return <EditSession post={post.data} openedDraft={draft.data} />;
}

/**
 * 글과 임시저장을 다 받은 뒤의 수정 화면. 들어올 때 받은 수정본(`openedDraft`)을 처음 값으로
 * 한 번만 읽는다 — 이후 자동저장으로 바뀌는 수정본은 여기 상태(`latest`)가 들고 있다.
 */
function EditSession({ post, openedDraft }: { post: EditablePost; openedDraft: Draft | null }) {
  const [start, setStart] = useState<Start>(openedDraft ? "draft" : "post");
  // 서버에 있는 이 글의 수정본. 저장한 뒤 지울 번호와 "수정본 다시 불러오기" 가 여기서 온다.
  const [latest, setLatest] = useState(openedDraft);
  // 지금 에디터를 채운 수정본. 다시 불러올 때마다 그 순간의 `latest` 로 바뀐다.
  const [loaded, setLoaded] = useState(openedDraft);

  const switchStart = () => {
    if (start === "draft") {
      setStart("post");
      return;
    }
    setLoaded(latest);
    setStart("draft");
  };

  // 화면군(`(focus)`)의 main 이 가로 flex 라 줄과 폼을 세로로 한 번 묶는다.
  return (
    <div className="flex w-full max-w-180 flex-col">
      {/* 들어올 때 수정본이 있었을 때만. 여기서 처음 저장한 수정본은 "불러온" 것이 아니다. */}
      {openedDraft && loaded ? (
        <RestoreBar savedAt={loaded.updatedAt} start={start} onSwitch={switchStart} />
      ) : null}
      <EditFields
        key={start}
        post={post}
        from={start === "draft" ? loaded : null}
        draftId={latest?.id ?? null}
        onDraftSaved={setLatest}
      />
    </div>
  );
}

/**
 * 임시저장한 수정본이 있을 때 맨 위에 붙는 줄. 원래 글과 수정본 사이를 오갈 수 있다.
 *
 * 원래 글로 되돌려도 서버의 수정본은 바로 지우지 않는다 — 고치기 시작하면 그때 덮어쓴다.
 * 실수로 눌렀으면 아무것도 안 고친 채 "수정본 다시 불러오기" 로 돌아올 수 있다.
 */
function RestoreBar({
  savedAt,
  start,
  onSwitch,
}: {
  savedAt: string;
  start: Start;
  onSwitch: () => void;
}) {
  return (
    <div
      role="status"
      className="mb-6 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-border-subtle bg-surface px-4 py-3 text-sm"
    >
      <p className="min-w-0 flex-1 text-text-muted">
        {start === "draft" ? (
          <>
            <b className="font-semibold text-text-primary">{formatRelativeTime(savedAt)}</b>{" "}
            임시저장한 수정본을 불러왔습니다.
          </>
        ) : (
          "원래 글로 되돌렸습니다. 고치면 임시저장한 수정본을 덮어씁니다."
        )}
      </p>
      <button type="button" className="flex-none font-semibold text-brand" onClick={onSwitch}>
        {start === "draft" ? "원래 글로 되돌리기" : "수정본 다시 불러오기"}
      </button>
    </div>
  );
}

/**
 * 입력 칸들. 에디터와 이미지 훅이 처음 값을 마운트 때 한 번만 읽어서, 글과 임시저장을
 * 다 받은 뒤에 그린다.
 *
 * `from` 이 있으면 임시저장한 수정본으로, 없으면 원래 글로 채운다. `draftId` 는 시작 값과
 * 상관없이 서버에 있는 이 글의 수정본 번호다 — 수정을 저장한 뒤 이 번호를 지운다.
 */
function EditFields({
  post,
  from,
  draftId,
  onDraftSaved,
}: {
  post: EditablePost;
  from: Draft | null;
  draftId: number | null;
  onDraftSaved: (draft: Draft) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(from?.title ?? post.title);
  const [content, setContent] = useState(from?.content ?? post.content);
  const [youtubeUrl, setYoutubeUrl] = useState(from?.youtubeUrl ?? post.youtubeUrl);
  const images = useImageUploads(from?.images ?? post.images);
  const [problem, setProblem] = useState("");
  const [savedAt, setSavedAt] = useState(from?.updatedAt ?? "");
  // 10개가 차서 새로 만들지 못했거나(409) 원래 글에 더는 쓸 수 없으면(403 · 404) 자동저장을
  // 멈춘다. 같은 실패를 몇 초마다 되풀이하지 않게. 버튼으로는 계속 시도할 수 있다.
  const [autoBlocked, setAutoBlocked] = useState(false);
  const room = post.coinSymbol;
  const back = postHref(room, post.id);

  const input = { title, content, youtubeUrl, images: images.uploaded };
  const snapshot = JSON.stringify(input);
  // 마지막으로 서버에 있는 내용. 처음에는 시작 값 — 수정본으로 시작했으면 서버와 같고, 원래
  // 글로 시작했으면 고치기 전까지 임시저장할 것이 없다.
  const [lastSaved, setLastSaved] = useState(snapshot);

  const save = useMutation({
    mutationFn: updatePost,
    onSuccess: async () => {
      // 수정이 저장됐으니 임시저장은 지운다. 실패해도 수정은 된 것이라 넘어간다 —
      // 마이페이지 임시저장 목록에 하나 남을 뿐이다.
      if (draftId !== null) {
        await deleteDraft(draftId).catch(() => undefined);
        void queryClient.invalidateQueries({ queryKey: ["drafts"] });
      }
      await queryClient.invalidateQueries({ queryKey: ["post", post.id] });
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      // 뒤로가기로 수정 화면에 돌아오지 않도록 replace 한다.
      router.replace(back);
    },
  });

  const draftSave = useMutation({
    mutationFn: (next: { input: EditDraftInput; snapshot: string; auto: boolean }) =>
      saveEditDraft(post.id, next.input),
    onSuccess: (saved, next) => {
      setLastSaved(next.snapshot);
      setAutoBlocked(false);
      setSavedAt(saved.updatedAt || new Date().toISOString());
      onDraftSaved(saved);
      void queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
    onError: (error, next) => {
      if (!next.auto || !(error instanceof ApiError)) return;
      if ([403, 404, 409].includes(error.status)) setAutoBlocked(true);
    },
  });

  const saveDraftNow = (auto: boolean) =>
    draftSave.mutate({
      input: { ...input, coinSymbol: room, tradingView: post.tradingView },
      snapshot,
      auto,
    });

  /**
   * 자동저장. 입력이 멈추고 `AUTOSAVE_DELAY` 가 지나면 저장한다. 한 번에 하나만 보내고,
   * 보내는 사이 바뀐 내용은 끝난 뒤 다음 타이머가 실어 보낸다.
   */
  const canAutosave =
    !autoBlocked &&
    !images.uploading &&
    !draftSave.isPending &&
    !save.isPending &&
    !save.isSuccess &&
    snapshot !== lastSaved;

  useEffect(() => {
    if (!canAutosave) return;
    const timer = window.setTimeout(() => saveDraftNow(true), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
    // 내용(snapshot)이 바뀔 때마다 타이머를 다시 건다. saveDraftNow 는 매번 새 함수라 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutosave, snapshot]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = draftProblem({ coinSymbol: room, title, content, youtubeUrl });
    setProblem(found ?? "");
    if (found) return;
    draftSave.reset();
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
  // 임시저장이 도는 중에 저장하면, 저장 뒤 삭제와 엇갈려 임시저장이 하나 남을 수 있다.
  const locked = pending || images.uploading || draftSave.isPending;
  const errorMessage =
    problem ||
    (save.error ? saveErrorMessage(save.error) : "") ||
    (draftSave.error ? draftErrorMessage(draftSave.error) : "");

  return (
    <form className="w-full max-w-180" onSubmit={submit} noValidate>
      {/* 좁은 화면에서는 버튼이 다음 줄로 내려간다. 임시저장 버튼이 늘어 한 줄에 다 안 들어간다. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-h2 font-semibold whitespace-nowrap">글 수정</h1>
        <div className="flex-1" />
        {savedAt ? (
          <span className="text-xs text-text-muted" aria-live="polite">
            {draftSave.isPending ? "저장 중…" : `${savedTime(savedAt)} 임시저장됨`}
          </span>
        ) : null}
        <Button type="button" onClick={() => router.back()} disabled={pending}>
          취소
        </Button>
        <Button type="button" disabled={locked} onClick={() => saveDraftNow(false)}>
          {draftSave.isPending ? "저장 중…" : "임시저장"}
        </Button>
        <Button type="submit" variant="primary" disabled={locked}>
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

      <BodyEditor
        onChange={setContent}
        disabled={pending}
        initialContent={from?.content ?? post.content}
      />
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
        <p className="mt-2">
          고친 내용은 자동으로 임시저장되고, 저장 버튼을 누르기 전까지 원래 글은 바뀌지 않습니다.
        </p>
      </div>
    </form>
  );
}

/** 입력이 멈추고 이만큼 지나면 자동저장한다. 글쓰기와 같은 값이다. */
const AUTOSAVE_DELAY = 3000;

const SAVED_TIME = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });

/** 임시저장 시각. 방금 저장한 것을 보여주는 자리라 날짜 없이 시:분만. */
function savedTime(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? "" : SAVED_TIME.format(at);
}

function ClosedRoom({ symbol }: { symbol: string }) {
  const rooms = useWriteRooms();
  return (
    <div className="w-full max-w-180">
      <RoomClosedNotice
        symbol={symbol}
        subject="글을 수정할 수 없습니다."
        openRooms={rooms.data?.filter((room) => room.open)}
      />
    </div>
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
  if (isRoomClosedError(error)) {
    return "방이 닫혀 수정을 저장하지 못했습니다. 방이 다시 열리면 저장할 수 있습니다.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 만료됐습니다. 다시 로그인해 주세요.";
    if (error.status === 403) return "내가 쓴 글만 수정할 수 있습니다.";
    if (error.status === 404) return "글이 삭제됐거나 찾을 수 없습니다.";
    return error.message;
  }
  return "저장하지 못했습니다. 네트워크 상태를 확인해 주세요.";
}

/** 임시저장 실패. 고친 내용은 화면에 그대로 있으니 그 사실을 같이 말한다. */
function draftErrorMessage(error: Error): string {
  if (isRoomClosedError(error)) {
    return "방이 닫혀 임시저장하지 못했습니다. 고친 내용은 화면에 그대로 있습니다.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 만료됐습니다. 다시 로그인해 주세요.";
    // 새 글 임시저장과 합쳐 10개가 찼다. 서버 문구가 그 이유를 말한다.
    if (error.status === 409) {
      return `${error.message} 마이페이지 임시저장에서 하나를 지우면 다시 저장됩니다.`;
    }
    if (error.status === 404) return "글이 삭제돼 임시저장할 수 없습니다.";
    return `임시저장하지 못했습니다. ${error.message}`;
  }
  return "임시저장하지 못했습니다. 고친 내용은 화면에 그대로 있습니다.";
}
