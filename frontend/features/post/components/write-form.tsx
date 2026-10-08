"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import { postHref } from "@/lib/routes";
import { unsupportedNotice } from "@/lib/holder-snapshot/label";
import { useSession } from "@/lib/session";
import { deleteDraft, loadDraft, loadWriteRooms, publishPost, saveDraft } from "../api";
import { useImageUploads } from "../hooks/use-image-uploads";
import { CONTENT_MAX, TITLE_MAX, draftProblem } from "../limits";
import BodyEditor from "./body-editor";
import CharCounter from "./char-counter";
import ImageAttachments from "./image-attachments";
import type { Draft } from "../types";
import DraftList from "./draft-list";
import YoutubeField from "./youtube-field";

type Props = {
  /** `?symbol=` 로 들어온 방. 페이지가 모양을 검사해서 넘겨준다. */
  initialSymbol: string | null;
  /** `?draft=` 로 들어온 임시저장 번호. 있으면 그 내용을 채운다. */
  draftId: number | null;
};

const FIELD =
  "w-full rounded-sm border border-border-subtle bg-canvas px-3 text-text-primary focus:-outline-offset-1 focus:outline-2 focus:outline-brand";

/**
 * 글쓰기 — 방 선택 + 제목 + 본문(리치텍스트) + 이미지 + 유튜브 링크 + 발행.
 *
 * 본문은 Markdown 문자열로 저장한다(E-2). 이유는 `body-editor.tsx` 참고.
 *
 * 와이어프레임(`크립톡_글쓰기_와이어프레임_v2`)에서 아직 없는 것
 *   - 차트 블록, 본문 중간에 이미지 끼워 넣기
 *   - "이 글에 붙을 정보" 미리보기 (`/me/assets` + badge 문구)
 *   - 미리보기
 *
 * 임시저장(HODL-43)은 서버에 한다. 처음 저장하면 새로 만들고, 그 뒤로는 같은 것을
 * 덮어쓴다. 주소에 `?draft=<번호>` 를 남겨 새로고침해도 이어 쓴다. 발행하면 지운다.
 */
export default function WriteForm({ initialSymbol, draftId }: Props) {
  const router = useRouter();
  const { member, restored } = useSession();

  // 글쓰기는 로그인이 필요하다(POST /posts). 세션 복원이 끝난 뒤에만 판단한다.
  // 끝나기 전에 보내면 로그인한 사람도 로그인 화면을 한 번 거친다.
  const loggedOut = restored && !member;
  useEffect(() => {
    if (!loggedOut) return;
    const here = draftId
      ? `/write?draft=${draftId}`
      : initialSymbol
        ? `/write?symbol=${initialSymbol}`
        : "/write";
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [loggedOut, initialSymbol, draftId, router]);

  // 임시저장은 본인 것만 열린다. 로그인 확인이 끝난 뒤에 부른다.
  const draft = useQuery({
    queryKey: ["draft", draftId],
    queryFn: () => loadDraft(draftId ?? 0),
    enabled: draftId !== null && !!member,
    gcTime: 0,
  });

  if (draftId === null) return <WriteFields key="new" initialSymbol={initialSymbol} draft={null} />;

  if (draft.isPending) return <p className="text-sm text-text-muted">임시저장을 불러오는 중…</p>;

  if (draft.isError) {
    const status = draft.error instanceof ApiError ? draft.error.status : 0;
    return (
      <div className="w-full max-w-180 rounded-lg border border-border-subtle bg-surface p-6 text-center">
        <p className="text-body font-semibold">
          {status === 404 || status === 403
            ? "임시저장을 찾을 수 없습니다."
            : "임시저장을 불러오지 못했습니다."}
        </p>
        <Button type="button" className="mt-4" onClick={() => router.replace("/write")}>
          새 글 쓰기
        </Button>
      </div>
    );
  }

  // 임시저장마다 key 가 달라서, 목록에서 다른 것을 고르면 에디터가 새로 마운트된다.
  return <WriteFields key={draftId} initialSymbol={null} draft={draft.data} />;
}

/**
 * 입력 칸들. 에디터와 이미지 훅이 처음 값을 마운트 때 한 번만 읽어서, 불러올
 * 임시저장이 있으면 다 받은 뒤에 그린다.
 */
function WriteFields({
  initialSymbol,
  draft,
}: {
  initialSymbol: string | null;
  draft: Draft | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { member, restored } = useSession();
  const loggedOut = restored && !member;

  const [pickedSymbol, setCoinSymbol] = useState(draft?.coinSymbol || initialSymbol || "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [content, setContent] = useState(draft?.content ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(draft?.youtubeUrl ?? "");
  const images = useImageUploads(draft?.images);
  const [problem, setProblem] = useState("");
  const [draftId, setDraftId] = useState(draft?.id ?? null);
  const [savedAt, setSavedAt] = useState(draft?.updatedAt ?? "");
  const [listOpen, setListOpen] = useState(false);

  const rooms = useQuery({ queryKey: ["write-rooms"], queryFn: loadWriteRooms });

  // `?symbol=` 이 목록에 없는 방이면 고르지 않은 것으로 본다. 그대로 두면
  // select 는 첫 항목을 보여주는데 발행은 다른 값으로 나간다.
  const unknownSymbol = rooms.data && !rooms.data.some((room) => room.symbol === pickedSymbol);
  const coinSymbol = unknownSymbol ? "" : pickedSymbol;

  const publish = useMutation({
    mutationFn: publishPost,
    onSuccess: async (post) => {
      // 발행이 끝났으니 임시저장은 지운다. 실패해도 발행은 된 것이라 넘어간다 —
      // 목록에 하나 남을 뿐이다.
      if (draftId !== null) {
        await deleteDraft(draftId).catch(() => undefined);
        void queryClient.invalidateQueries({ queryKey: ["drafts"] });
      }
      // 뒤로가기로 빈 글쓰기 화면에 돌아오지 않도록 replace 한다.
      router.replace(postHref(post.coinSymbol, post.id));
    },
  });

  const save = useMutation({
    mutationFn: () =>
      saveDraft({ coinSymbol, title, content, youtubeUrl, images: images.uploaded }, draftId),
    onSuccess: (saved) => {
      setDraftId(saved.id);
      setSavedAt(saved.updatedAt || new Date().toISOString());
      // 새로고침해도 이어 쓰도록 주소에 남긴다. router 로 바꾸면 페이지가 다시 그려져
      // 에디터가 새로 마운트되므로 주소만 바꾼다.
      window.history.replaceState(null, "", `/write?draft=${saved.id}`);
      void queryClient.invalidateQueries({ queryKey: ["drafts"] });
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const verifiable = rooms.data?.find((room) => room.symbol === coinSymbol)?.verifiable ?? false;
    const draft = { coinSymbol, title, content, youtubeUrl, images: images.uploaded, verifiable };
    const found = draftProblem(draft);
    setProblem(found ?? "");
    if (found) return;
    save.reset();
    publish.mutate(draft);
  };

  const selectedRoom = rooms.data?.find((room) => room.symbol === coinSymbol);
  const selectedName = selectedRoom?.name;
  const errorMessage =
    problem ||
    (publish.error ? publishErrorMessage(publish.error) : "") ||
    (save.error ? saveErrorMessage(save.error) : "");
  const pending = publish.isPending || publish.isSuccess;
  // 업로드 중에도 글은 계속 쓸 수 있다. 발행과 임시저장만 잠근다 — 올라가는 중인
  // 이미지는 아직 주소가 없어 저장에 실리지 않는다.
  const publishLocked = pending || loggedOut || images.uploading;
  const saveLocked = publishLocked || save.isPending;

  return (
    <form className="w-full max-w-180" onSubmit={submit} noValidate>
      <div className="flex items-center gap-4">
        <h1 className="text-h2 font-semibold">글쓰기</h1>
        <button
          type="button"
          className="text-sm text-text-muted hover:text-text-primary"
          aria-expanded={listOpen}
          onClick={() => setListOpen((open) => !open)}
        >
          임시저장 목록
        </button>
        <div className="flex-1" />
        {savedAt ? (
          <span className="text-xs text-text-muted" aria-live="polite">
            {save.isPending ? "저장 중…" : `${savedTime(savedAt)} 임시저장됨`}
          </span>
        ) : null}
        <Button type="button" onClick={() => router.back()}>
          나가기
        </Button>
        <Button type="button" disabled={saveLocked} onClick={() => save.mutate()}>
          {save.isPending ? "저장 중…" : "임시저장"}
        </Button>
        <Button type="submit" variant="primary" disabled={publishLocked}>
          {pending ? "발행 중…" : images.uploading ? "업로드 중…" : "발행"}
        </Button>
      </div>

      {listOpen ? (
        <DraftList
          currentId={draftId}
          onDeleted={(id) => {
            // 지금 쓰고 있는 임시저장을 지웠으면, 다음 저장은 새로 만든다.
            if (id !== draftId) return;
            setDraftId(null);
            setSavedAt("");
            window.history.replaceState(null, "", "/write");
          }}
        />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <select
          className={`${FIELD} h-10 max-w-60 text-sm`}
          aria-label="방 선택"
          value={coinSymbol}
          onChange={(event) => setCoinSymbol(event.target.value)}
          disabled={!rooms.data}
        >
          <option value="">{rooms.isError ? "방 목록을 못 불러왔습니다" : "방을 고르세요"}</option>
          {rooms.data?.map((room) => (
            <option key={room.symbol} value={room.symbol}>
              {room.symbol} · {room.name} 방
            </option>
          ))}
        </select>
        <p className="text-sm text-text-muted">
          {/* 방 목록이 오기 전에는 select 가 비어 보이므로 안내도 고른 방을 말하지 않는다. */}
          {coinSymbol && rooms.data ? (
            <>
              <b className="font-semibold text-text-primary">{coinSymbol}</b>
              {selectedName ? ` (${selectedName})` : ""} 보유량이 발행 시점 기준으로 글에 붙습니다
            </>
          ) : (
            "고른 방의 코인 보유량이 글에 붙습니다"
          )}
        </p>
      </div>

      {selectedRoom && !selectedRoom.verifiable ? (
        <p role="note" className="mt-2 text-sm text-danger">
          {unsupportedNotice(selectedRoom.symbol)}
        </p>
      ) : null}

      <input
        className={`${FIELD} mt-6 h-12 text-h2`}
        aria-label="제목"
        placeholder="제목"
        value={title}
        maxLength={TITLE_MAX}
        onChange={(event) => setTitle(event.target.value)}
      />
      <CharCounter length={title.length} max={TITLE_MAX} />

      <BodyEditor onChange={setContent} disabled={pending} initialContent={draft?.content} />
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
          보유 정보는 <b className="font-semibold text-text-primary">발행 시점에 확정</b>되며 이후
          수정해도 바뀌지 않습니다. 수량은 구간으로만 공개되고 지갑 주소는 공개되지 않습니다.
        </p>
        <p className="mt-2">지갑을 연결하지 않았다면 미인증으로 발행됩니다.</p>
      </div>

      <p className="mt-4 text-xs text-text-subtle">
        게시물은 투자 권유가 아니며, 투자 판단의 책임은 이용자에게 있습니다.
        <br />
        리딩방·유료방 홍보는 예고 없이 삭제됩니다.
      </p>
    </form>
  );
}

const SAVED_TIME = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });

/** 임시저장 시각. 방금 저장한 것을 보여주는 자리라 날짜 없이 시:분만. */
function savedTime(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? "" : SAVED_TIME.format(at);
}

function saveErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 만료됐습니다. 다시 로그인해 주세요.";
    // 10개 초과, 또는 이미지가 다른 임시저장에 묶여 있음. 서버 문구가 그 이유를 말한다.
    if (error.status === 409) return error.message;
    if (error.status === 404 || error.status === 403) {
      return "이 임시저장이 지워졌습니다. 목록을 다시 열어 확인해 주세요.";
    }
    return error.message;
  }
  return "임시저장하지 못했습니다. 네트워크 상태를 확인해 주세요.";
}

/**
 * 에러 code 목록은 아직 합의 전이라(C-5) 상태 코드로만 나눈다.
 * 401 은 http 래퍼가 갱신을 한 번 시도한 뒤에도 실패한 경우다.
 */
function publishErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 만료됐습니다. 다시 로그인해 주세요.";
    if (error.status === 404) return "이 방을 찾을 수 없습니다. 다른 방을 골라 주세요.";
    // 발행은 더 이상 지갑 잔액을 조회하지 않는다(HODL-42 수정). 503 은 서버가 잠시
    // 응답하지 못한 경우다. 쓴 글은 화면에 그대로 남아 있으니 다시 시도하면 된다.
    if (error.status === 503) {
      return "서버가 잠시 응답하지 못해 발행하지 못했습니다. 쓴 글은 그대로 있으니 잠시 후 다시 발행해 주세요.";
    }
    return error.message;
  }
  return "발행하지 못했습니다. 네트워크 상태를 확인해 주세요.";
}
