"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import AnimalBadge from "@/components/holder/animal-badge";
import { Button } from "@/components/ui/button";
import { markdownToPlainText } from "@/lib/format/plain-text";
import { formatDate } from "@/lib/format/time";
import { holdingPeriodLabel } from "@/lib/holder-snapshot/label";
import { ApiError } from "@/lib/http";
import { useSession } from "@/lib/session";
import PageLinks from "@/components/page-links";
import { MYPAGE_HREF, commentHref, postHref, profileHref, type ProfileTab } from "@/lib/routes";
import { loadProfile, loadProfileItems } from "../api";

const CARD = "rounded-lg border border-border-subtle bg-surface";
const TAB =
  "border-b-2 border-transparent py-2 text-sm font-semibold text-text-muted hover:text-text-primary";
const TAB_ACTIVE = "border-b-brand text-text-primary";

/**
 * 공개 프로필 `/user/{회원 id}` (HODL-75 · 104).
 *
 * 프로필과 글 · 댓글 목록 모두 회원 id 로 부른다. 닉네임은 보여 주기만 한다 — 규칙(HODL-103)
 * 전에 만든 닉네임에 공백 · `@` 같은 문자가 있어도 손대지 않고 그대로 쓴다.
 * 탭과 쪽은 주소(`?tab=comments&page=2`)라 새로고침 · 뒤로 가기에도 남는다.
 */
export default function PublicProfileView({
  memberId,
  tab,
  page,
}: {
  memberId: number;
  tab: ProfileTab;
  /** 1부터. */
  page: number;
}) {
  const { member } = useSession();
  const profile = useQuery({
    queryKey: ["public-profile", memberId],
    queryFn: () => loadProfile(memberId),
    // 404(없는 회원)는 다시 물어도 같다. 그 밖의 실패는 화면의 "다시 시도" 로.
    retry: false,
  });
  const items = useQuery({
    queryKey: ["public-profile-items", memberId, tab, page],
    queryFn: () => loadProfileItems(memberId, tab, page),
    // 프로필이 없으면(404) 목록도 없다. 프로필이 온 뒤에 부른다.
    enabled: profile.isSuccess,
  });
  const href = (nextTab: ProfileTab, nextPage = 1) =>
    profileHref(memberId, { tab: nextTab, page: nextPage });

  if (profile.isPending)
    return <p className="py-16 text-center text-sm text-text-muted">프로필 불러오는 중…</p>;
  if (profile.isError) {
    // 없는 회원(404)은 다시 물어도 같아서 홈으로만 보낸다. 그 밖의 실패는 다시 시도.
    const missing = profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <section role="alert" className={`${CARD} flex flex-col items-center gap-3 px-6 py-16`}>
        <h1 className="text-h2 font-semibold text-text-primary">
          {missing ? "프로필을 찾을 수 없습니다." : "프로필을 불러오지 못했습니다."}
        </h1>
        {missing ? (
          <>
            <p className="text-sm text-text-muted">없는 회원이거나 주소가 잘못됐습니다.</p>
            <Button asChild>
              <Link href="/">홈으로</Link>
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => void profile.refetch()}>
            다시 시도
          </Button>
        )}
      </section>
    );
  }
  const data = profile.data;
  const joined = formatDate(data.joinedAt ?? data.createdAt);
  return (
    <div className="flex flex-col gap-4">
      <header className={`${CARD} flex items-start gap-4 p-6`}>
        <span
          aria-hidden
          className="flex size-14 flex-none items-center justify-center rounded-full text-xl font-bold text-text-inverse"
          style={{ background: data.avatarColor || "var(--brand)" }}
        >
          {data.nickname.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 font-semibold break-words text-text-primary">{data.nickname}</h1>
            {data.representativeBadge && (
              <AnimalBadge badge={data.representativeBadge} position="list" />
            )}
          </div>
          <p className="mt-1 text-sm text-text-muted tabular-nums">
            글 {data.postCount} · 댓글 {data.commentCount}
            {joined ? ` · ${joined} 가입` : ""}
          </p>
          {data.representativeBadge && (
            <p className="mt-1 text-xs text-text-subtle">배지는 최근 글 작성 시점 기준입니다.</p>
          )}
        </div>
        {member?.id === data.id && (
          <Button asChild className="flex-none">
            <Link href={MYPAGE_HREF}>마이페이지</Link>
          </Button>
        )}
      </header>

      <section className={`${CARD} p-5`} aria-labelledby="profile-assets-title">
        <h2 id="profile-assets-title" className="font-semibold text-text-primary">
          공개 보유 정보
        </h2>
        <p className="mt-1 text-sm text-text-muted">정확한 수량과 지갑 주소는 공개하지 않습니다.</p>
        {data.assets.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">공개된 보유 정보가 없습니다.</p>
        ) : (
          <ul className="mt-4 grid gap-2 min-[600px]:grid-cols-2">
            {data.assets.map((asset) => (
              <li
                key={asset.coinSymbol}
                className="flex items-center gap-3 rounded-sm bg-surface-muted px-3 py-2.5"
              >
                <span className="w-12 flex-none font-semibold text-text-primary">
                  {asset.coinSymbol}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-text-primary tabular-nums">
                    {asset.quantityBand}
                  </span>
                  <span className="block truncate text-xs text-text-muted">
                    {asset.coinName} · {holdingPeriodLabel(asset.holdingMonths)}
                    {asset.syncStatus === "PARTIAL" ? " · 일부 조회 기준" : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="flex gap-6 border-b border-border-subtle" aria-label="프로필 활동">
        {(
          [
            ["posts", `작성한 글 ${data.postCount}`],
            ["comments", `댓글 ${data.commentCount}`],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={href(value)}
            aria-current={tab === value ? "page" : undefined}
            className={`${TAB} ${tab === value ? TAB_ACTIVE : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {items.isPending ? (
        <p className="py-8 text-center text-sm text-text-muted">활동 불러오는 중…</p>
      ) : items.isError ? (
        <p className="py-8 text-center text-sm text-text-muted">
          활동을 불러오지 못했습니다.{" "}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => void items.refetch()}
          >
            다시 시도
          </button>
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          {items.data.items.length === 0 ? (
            <p className={`${CARD} py-10 text-center text-sm text-text-muted`}>
              {page > 1 ? (
                <>
                  이 쪽에는 {tab === "posts" ? "글" : "댓글"}이 없습니다.{" "}
                  <Link href={href(tab)} className="text-brand hover:underline">
                    첫 쪽으로
                  </Link>
                </>
              ) : (
                `작성한 ${tab === "posts" ? "글" : "댓글"}이 없습니다.`
              )}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.data.items.map((item) => {
                const preview = markdownToPlainText(item.content);
                return (
                  <li key={item.id} className={`${CARD} p-4`}>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span className="rounded-sm border border-border-subtle px-2 py-0.5 font-semibold">
                        {item.coinSymbol}
                      </span>
                      {item.holderSnapshot && (
                        <>
                          <AnimalBadge badge={item.holderSnapshot.badge} position="list" />
                          <span className="tabular-nums">
                            작성 시점 {item.holderSnapshot.quantityBand ?? ""} ·{" "}
                            {holdingPeriodLabel(item.holderSnapshot.holdingMonths)}
                            {item.holderSnapshot.syncStatus === "PARTIAL"
                              ? " · 일부 조회 기준"
                              : ""}
                          </span>
                        </>
                      )}
                      <time dateTime={item.createdAt}>· {formatDate(item.createdAt)}</time>
                    </div>
                    <Link
                      href={
                        tab === "comments" && item.postId
                          ? commentHref(item.coinSymbol, item.postId, item.id)
                          : postHref(item.coinSymbol, item.id)
                      }
                      className="mt-2 block font-semibold break-words text-text-primary hover:text-brand"
                    >
                      {tab === "comments" ? (
                        <span className="text-text-muted">
                          {item.postTitle ?? "글 보기"}에 남긴 댓글
                        </span>
                      ) : (
                        (item.title ?? "글 보기")
                      )}
                    </Link>
                    {preview ? (
                      <p className="mt-1.5 line-clamp-2 text-sm break-words text-text-muted">
                        {preview}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <PageLinks
            page={page}
            totalPages={items.data.totalPages}
            hrefFor={(next) => href(tab, next)}
          />
        </section>
      )}
    </div>
  );
}
