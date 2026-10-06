"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/http";
import { postHref } from "@/lib/routes";
import { unsupportedNotice } from "@/lib/holder-snapshot/label";
import { useSession } from "@/lib/session";
import { loadWriteRooms, publishPost } from "../api";
import { useImageUploads } from "../hooks/use-image-uploads";
import { CONTENT_MAX, TITLE_MAX, draftProblem } from "../limits";
import BodyEditor from "./body-editor";
import ImageAttachments from "./image-attachments";
import YoutubeField from "./youtube-field";

type Props = {
  /** `?symbol=` 로 들어온 방. 페이지가 모양을 검사해서 넘겨준다. */
  initialSymbol: string | null;
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
 *   - 임시저장 · 미리보기
 */
export default function WriteForm({ initialSymbol }: Props) {
  const router = useRouter();
  const { member, restored } = useSession();

  const [pickedSymbol, setCoinSymbol] = useState(initialSymbol ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const images = useImageUploads();
  const [problem, setProblem] = useState("");

  // 글쓰기는 로그인이 필요하다(POST /posts). 세션 복원이 끝난 뒤에만 판단한다.
  // 끝나기 전에 보내면 로그인한 사람도 로그인 화면을 한 번 거친다.
  const loggedOut = restored && !member;
  useEffect(() => {
    if (!loggedOut) return;
    const here = initialSymbol ? `/write?symbol=${initialSymbol}` : "/write";
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [loggedOut, initialSymbol, router]);

  const rooms = useQuery({ queryKey: ["write-rooms"], queryFn: loadWriteRooms });

  // `?symbol=` 이 목록에 없는 방이면 고르지 않은 것으로 본다. 그대로 두면
  // select 는 첫 항목을 보여주는데 발행은 다른 값으로 나간다.
  const unknownSymbol = rooms.data && !rooms.data.some((room) => room.symbol === pickedSymbol);
  const coinSymbol = unknownSymbol ? "" : pickedSymbol;

  const publish = useMutation({
    mutationFn: publishPost,
    onSuccess: (post) => {
      // 뒤로가기로 빈 글쓰기 화면에 돌아오지 않도록 replace 한다.
      router.replace(postHref(post.coinSymbol, post.id));
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = { coinSymbol, title, content, youtubeUrl, images: images.uploaded };
    const found = draftProblem(draft);
    setProblem(found ?? "");
    if (found) return;
    publish.mutate(draft);
  };

  const selectedRoom = rooms.data?.find((room) => room.symbol === coinSymbol);
  const selectedName = selectedRoom?.name;
  const errorMessage = problem || (publish.error ? publishErrorMessage(publish.error) : "");
  const pending = publish.isPending || publish.isSuccess;
  // 업로드 중에도 글은 계속 쓸 수 있다. 발행만 잠근다.
  const publishLocked = pending || loggedOut || images.uploading;

  return (
    <form className="w-full max-w-180" onSubmit={submit} noValidate>
      <div className="flex items-center gap-4">
        <h1 className="text-h2 font-semibold">글쓰기</h1>
        <div className="flex-1" />
        <Button type="button" onClick={() => router.back()}>
          나가기
        </Button>
        <Button type="submit" variant="primary" disabled={publishLocked}>
          {pending ? "발행 중…" : images.uploading ? "업로드 중…" : "발행"}
        </Button>
      </div>

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
      <Counter length={title.length} max={TITLE_MAX} />

      <BodyEditor onChange={setContent} disabled={pending} />
      <Counter length={content.length} max={CONTENT_MAX} />

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

/**
 * 본문 글자 수는 서식 기호를 포함한 Markdown 길이다. 백엔드가 그 길이로 5000자를
 * 센다. 에디터는 입력을 끊지 않으므로 넘으면 빨갛게 보이고 발행에서 막힌다.
 */
function Counter({ length, max }: { length: number; max: number }) {
  return (
    <p
      className={`mt-1 text-right text-xs tabular-nums ${length > max ? "text-danger" : "text-text-subtle"}`}
    >
      {length.toLocaleString("ko-KR")} / {max.toLocaleString("ko-KR")}
    </p>
  );
}

/**
 * 에러 code 목록은 아직 합의 전이라(C-5) 상태 코드로만 나눈다.
 * 401 은 http 래퍼가 갱신을 한 번 시도한 뒤에도 실패한 경우다.
 */
function publishErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 만료됐습니다. 다시 로그인해 주세요.";
    if (error.status === 404) return "이 방을 찾을 수 없습니다. 다른 방을 골라 주세요.";
    return error.message;
  }
  return "발행하지 못했습니다. 네트워크 상태를 확인해 주세요.";
}
