"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PageLinks from "@/components/page-links";
import { ApiError } from "@/lib/http";
import { searchHref } from "@/lib/routes";
import { loadSearch } from "../api";
import { searchProblem } from "../limits";
import SearchBox from "./search-box";
import SearchResultItem from "./search-result-item";

type Props = {
  /** 주소의 `q`. 앞뒤 공백은 페이지가 잘라서 넘긴다. */
  q: string;
  /** 지금 쪽. 1부터. */
  page: number;
  /** 주소의 `room`. 있으면 그 방의 글 · 댓글만 찾는다(HODL-69). */
  room: string | null;
};

const TAB_CLASS =
  "border-b-2 border-transparent py-2 text-body font-semibold text-text-muted hover:text-text-primary";
const TAB_ACTIVE = "border-b-brand text-text-primary";

/**
 * 검색 결과 화면 (HODL-65 · 69).
 *
 * 검색어 · 범위 · 쪽은 전부 주소에 있다(`/search?q=…&room=ETH&page=2`). 새로고침 · 링크 공유 · 뒤로 가기가 그대로 된다.
 * 방 안에서 헤더로 찾으면 그 방 범위로 열리고, 탭으로 전체 검색으로 넓힐 수 있다.
 *
 * 쪽을 넘길 때 새 쪽이 올 때까지 이전 결과를 흐리게 남긴다(방 게시판과 같음).
 */
export default function SearchView({ q, page, room }: Props) {
  const problem = q ? searchProblem(q) : null;
  const enabled = !!q && !problem;

  const search = useQuery({
    queryKey: ["search", room, q, page],
    queryFn: () => loadSearch({ q, page, room }),
    enabled,
    placeholderData: keepPreviousData,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });

  const results = search.data?.results ?? [];
  const totalPages = search.data?.totalPages ?? 0;
  const pastEnd = search.isSuccess && results.length === 0 && totalPages > 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2 font-semibold text-text-primary">검색</h1>
      <SearchBox key={`${room}-${q}`} initial={q} room={room} />

      {room && q ? (
        <nav className="flex gap-6 border-b border-border-subtle" aria-label="검색 범위">
          <span aria-current="page" className={`${TAB_CLASS} ${TAB_ACTIVE}`}>
            {room} 방
          </span>
          <Link href={searchHref(q)} className={TAB_CLASS}>
            전체
          </Link>
        </nav>
      ) : null}

      {!q ? (
        <p className="px-4 py-12 text-center text-text-muted">
          {room
            ? `${room} 방의 글과 댓글을 찾을 수 있습니다.`
            : "글 · 댓글 · 방 · 닉네임을 찾을 수 있습니다."}
        </p>
      ) : problem ? (
        <p role="alert" className="px-4 py-12 text-center text-text-muted">
          {problem}
        </p>
      ) : search.isPending ? (
        <p className="text-sm text-text-muted">검색하는 중…</p>
      ) : search.isError ? (
        <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
          <p className="text-body font-semibold">{errorMessage(search.error, room)}</p>
          {search.error instanceof ApiError && search.error.status < 500 ? null : (
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-brand"
              onClick={() => search.refetch()}
            >
              다시 시도
            </button>
          )}
        </div>
      ) : (
        <section
          aria-label="검색 결과"
          aria-busy={search.isPlaceholderData}
          className={`flex flex-col gap-2 transition-opacity ${search.isPlaceholderData ? "opacity-60" : ""}`}
        >
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text-primary">‘{q}’</span> 검색 결과{" "}
            <span className="tabular-nums">
              {search.data?.totalElements.toLocaleString("ko-KR")}
            </span>
            건 · 관련도순
          </p>

          {results.map((result) => (
            <SearchResultItem key={result.key} result={result} q={q} />
          ))}

          {pastEnd ? (
            <p className="px-4 py-12 text-center text-text-muted">
              이 쪽에는 결과가 없습니다.{" "}
              <Link href={searchHref(q, { room })} className="font-semibold text-brand">
                첫 쪽으로
              </Link>
            </p>
          ) : null}

          {results.length === 0 && !pastEnd ? (
            <p className="px-4 py-12 text-center text-text-muted">
              검색 결과가 없습니다.
              {room ? (
                <>
                  {" "}
                  <Link href={searchHref(q)} className="font-semibold text-brand">
                    전체에서 찾기
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <PageLinks
            page={page}
            totalPages={totalPages}
            hrefFor={(target) => searchHref(q, { room, page: target })}
          />
        </section>
      )}
    </div>
  );
}

function errorMessage(error: Error, room: string | null): string {
  if (error instanceof ApiError) {
    if (error.status === 404 && room) return `${room} 방이 없거나 지금 운영 중이 아닙니다.`;
    if (error.status === 400) return error.message || "검색어를 확인해 주세요.";
  }
  return "검색하지 못했습니다.";
}
