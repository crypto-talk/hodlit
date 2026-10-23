"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { searchHref } from "@/lib/routes";
import { SEARCH_MAX, searchProblem } from "../limits";

type Props = {
  /** 처음 채울 검색어(결과 화면의 지금 검색어). */
  initial: string;
  /** 방 안에서 찾는 중이면 그 방. 새로 찾아도 범위를 유지한다. */
  room: string | null;
};

/**
 * 결과 화면 위의 검색칸. 새 검색어로 보내면 1쪽부터 다시 본다(주소에 쪽을 싣지 않는다).
 *
 * 헤더 검색칸은 보내고 비워지므로, 결과 화면에서 검색어를 고치는 곳은 여기다.
 */
export default function SearchBox({ initial, room }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [problem, setProblem] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const reason = searchProblem(q);
    setProblem(reason ?? "");
    if (reason) return;
    router.push(searchHref(q.trim(), { room }));
  }

  return (
    <form role="search" onSubmit={submit}>
      <div className="flex gap-2">
        <input
          type="search"
          aria-label={room ? `${room} 방에서 검색` : "검색"}
          className="h-10 min-w-0 flex-1 rounded-sm border border-border-subtle bg-surface px-3 text-body text-text-primary focus:-outline-offset-1 focus:outline-2 focus:outline-brand"
          placeholder={room ? `${room} 방의 글 · 댓글 검색` : "글 · 댓글 · 방 · 닉네임 검색"}
          value={q}
          maxLength={SEARCH_MAX + 20}
          onChange={(event) => {
            setQ(event.target.value);
            if (problem) setProblem("");
          }}
        />
        <button
          type="submit"
          className="h-10 flex-none rounded-sm bg-brand px-4 text-sm font-semibold text-text-inverse"
        >
          검색
        </button>
      </div>
      {problem ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {problem}
        </p>
      ) : null}
    </form>
  );
}
