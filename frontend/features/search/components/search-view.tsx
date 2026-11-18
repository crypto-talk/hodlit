"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PageLinks from "@/components/page-links";
import { ApiError } from "@/lib/http";
import { searchHref } from "@/lib/routes";
import { loadSearch, loadSearchGroups } from "../api";
import { CATEGORY_LABEL, categoriesFor } from "../categories";
import { searchProblem } from "../limits";
import type { SearchCategory, SearchGroup } from "../types";
import SearchBox from "./search-box";
import SearchResultItem from "./search-result-item";

type Props = {
  /** 주소의 `q`. 앞뒤 공백은 페이지가 잘라서 넘긴다. */
  q: string;
  /** 지금 쪽. 1부터. 분류를 골랐을 때만 쓴다. */
  page: number;
  /** 주소의 `room`. 있으면 그 방의 글 · 댓글만 찾는다(HODL-69). */
  room: string | null;
  /** 주소의 `type`. 없으면 분류별 미리보기 화면이다(HODL-100). */
  category: SearchCategory | null;
};

const TAB_CLASS =
  "border-b-2 border-transparent py-2 text-body font-semibold text-text-muted hover:text-text-primary";
const TAB_ACTIVE = "border-b-brand text-text-primary";
const CHIP_CLASS =
  "flex-none rounded-full border border-border-subtle px-3 py-1 text-sm font-semibold text-text-muted hover:text-text-primary";
const CHIP_ACTIVE = "border-text-primary bg-text-primary text-surface hover:text-surface";

const noRetryOnClientError = (count: number, error: Error) =>
  !(error instanceof ApiError && error.status < 500) && count < 2;

/**
 * 검색 결과 화면 (HODL-65 · 69 · 100).
 *
 * 검색어 · 범위 · 분류 · 쪽은 전부 주소에 있다(`/search?q=…&room=ETH&type=posts&page=2`).
 * 새로고침 · 링크 공유 · 뒤로 가기가 그대로 된다.
 *
 * - 분류가 없으면(전체) 분류마다 건수와 앞의 몇 건을 보여 준다. 더 보려면 그 분류로 들어간다.
 * - 분류를 고르면 그 분류만 쪽 번호로 넘긴다.
 * - 방 안에서 헤더로 찾으면 그 방 범위로 열리고(글 · 댓글만), 위 탭으로 전체 검색으로 넓힐 수 있다.
 *
 * 요청은 주소 값으로 키를 잡는다. 검색어 · 분류를 빠르게 바꿔도 늦게 온 이전 응답이 지금 화면을 덮지 않는다.
 */
export default function SearchView({ q, page, room, category }: Props) {
  const problem = q ? searchProblem(q) : null;
  const enabled = !!q && !problem;

  // 분류 칩의 건수와 전체 화면의 미리보기. 분류 화면에서도 건수를 보이려고 같이 읽는다(실패해도 목록은 뜬다).
  const groups = useQuery({
    queryKey: ["search", "groups", room, q],
    queryFn: () => loadSearchGroups({ q, room }),
    enabled,
    retry: noRetryOnClientError,
  });

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

      {enabled ? (
        <nav className="flex gap-2 overflow-x-auto" aria-label="결과 분류">
          <Link
            href={searchHref(q, { room })}
            aria-current={category ? undefined : "page"}
            className={`${CHIP_CLASS} ${category ? "" : CHIP_ACTIVE}`}
          >
            전체
          </Link>
          {categoriesFor(room).map((each) => {
            const count = groups.data?.find((group) => group.category === each)?.totalElements;
            return (
              <Link
                key={each}
                href={searchHref(q, { room, type: each })}
                aria-current={category === each ? "page" : undefined}
                className={`${CHIP_CLASS} ${category === each ? CHIP_ACTIVE : ""}`}
              >
                {CATEGORY_LABEL[each]}
                {count === undefined ? null : (
                  <span className="ml-1 font-normal tabular-nums">
                    {count.toLocaleString("ko-KR")}
                  </span>
                )}
              </Link>
            );
          })}
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
      ) : category ? (
        <CategoryResults key={category} q={q} page={page} room={room} category={category} />
      ) : groups.isPending ? (
        <p className="text-sm text-text-muted">검색하는 중…</p>
      ) : groups.isError ? (
        <SearchError error={groups.error} room={room} onRetry={() => groups.refetch()} />
      ) : (
        <GroupPreviews q={q} room={room} groups={groups.data} />
      )}
    </div>
  );
}

/** 전체 화면. 분류마다 제목 · 건수 · 앞의 몇 건. 0건인 분류도 자리를 남겨 없다는 것을 알린다. */
function GroupPreviews({
  q,
  room,
  groups,
}: {
  q: string;
  room: string | null;
  groups: SearchGroup[];
}) {
  if (groups.every((group) => group.totalElements === 0)) {
    return (
      <p className="px-4 py-12 text-center text-text-muted">
        <span className="font-semibold text-text-primary">‘{q}’</span> 검색 결과가 없습니다.
        {room ? (
          <>
            {" "}
            <Link href={searchHref(q)} className="font-semibold text-brand">
              전체에서 찾기
            </Link>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => {
        const label = CATEGORY_LABEL[group.category];
        const headingId = `search-group-${group.category}`;
        const more = group.totalElements > group.results.length;
        return (
          <section key={group.category} aria-labelledby={headingId} className="flex flex-col gap-2">
            <h2 id={headingId} className="text-body font-semibold text-text-primary">
              {label}{" "}
              <span className="font-normal text-text-muted tabular-nums">
                {group.totalElements.toLocaleString("ko-KR")}건
              </span>
            </h2>
            {group.totalElements === 0 ? (
              <p className="rounded-lg border border-dashed border-border-subtle px-4 py-4 text-sm text-text-muted">
                {label} 결과가 없습니다.
              </p>
            ) : (
              <>
                {group.results.map((result) => (
                  <SearchResultItem key={result.key} result={result} q={q} />
                ))}
                {more ? (
                  <Link
                    href={searchHref(q, { room, type: group.category })}
                    className="self-start text-sm font-semibold text-brand"
                  >
                    {label} 결과 {group.totalElements.toLocaleString("ko-KR")}건 모두 보기
                  </Link>
                ) : null}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** 한 분류의 목록. 쪽을 넘길 때 새 쪽이 올 때까지 이전 결과를 흐리게 남긴다(방 게시판과 같음). */
function CategoryResults({
  q,
  page,
  room,
  category,
}: {
  q: string;
  page: number;
  room: string | null;
  category: SearchCategory;
}) {
  const search = useQuery({
    queryKey: ["search", "list", room, category, q, page],
    queryFn: () => loadSearch({ q, page, room, category }),
    placeholderData: keepPreviousData,
    retry: noRetryOnClientError,
  });

  if (search.isPending) return <p className="text-sm text-text-muted">검색하는 중…</p>;
  if (search.isError) {
    return <SearchError error={search.error} room={room} onRetry={() => search.refetch()} />;
  }

  const label = CATEGORY_LABEL[category];
  const { results, totalElements, totalPages } = search.data;
  const pastEnd = results.length === 0 && totalPages > 0;

  return (
    <section
      aria-label={`${label} 검색 결과`}
      aria-busy={search.isPlaceholderData}
      className={`flex flex-col gap-2 transition-opacity ${search.isPlaceholderData ? "opacity-60" : ""}`}
    >
      <p className="text-sm text-text-muted">
        <span className="font-semibold text-text-primary">‘{q}’</span> {label} 결과{" "}
        <span className="tabular-nums">{totalElements.toLocaleString("ko-KR")}</span>건 · 관련도순
      </p>

      {results.map((result) => (
        <SearchResultItem key={result.key} result={result} q={q} />
      ))}

      {pastEnd ? (
        <p className="px-4 py-12 text-center text-text-muted">
          이 쪽에는 결과가 없습니다.{" "}
          <Link href={searchHref(q, { room, type: category })} className="font-semibold text-brand">
            첫 쪽으로
          </Link>
        </p>
      ) : null}

      {results.length === 0 && !pastEnd ? (
        <p className="px-4 py-12 text-center text-text-muted">
          {label} 결과가 없습니다.{" "}
          <Link href={searchHref(q, { room })} className="font-semibold text-brand">
            다른 분류 보기
          </Link>
        </p>
      ) : null}

      <PageLinks
        page={page}
        totalPages={totalPages}
        hrefFor={(target) => searchHref(q, { room, type: category, page: target })}
      />
    </section>
  );
}

function SearchError({
  error,
  room,
  onRetry,
}: {
  error: Error;
  room: string | null;
  onRetry: () => void;
}) {
  const clientError = error instanceof ApiError && error.status < 500;
  return (
    <div role="alert" className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
      <p className="text-body font-semibold">{errorMessage(error, room)}</p>
      {clientError ? null : (
        <button type="button" className="mt-4 text-sm font-semibold text-brand" onClick={onRetry}>
          다시 시도
        </button>
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
