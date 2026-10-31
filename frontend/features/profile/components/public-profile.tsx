"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import AnimalBadge from "@/components/holder/animal-badge";
import { holdingPeriodLabel } from "@/lib/holder-snapshot/label";
import { ApiError } from "@/lib/http";
import { useSession } from "@/lib/session";
import { postHref } from "@/lib/routes";
import { loadProfile, loadProfileItems } from "../api";

export default function PublicProfileView({
  nickname,
  tab,
  page,
}: {
  nickname: string;
  tab: "posts" | "comments";
  page: number;
}) {
  const { member } = useSession();
  const profile = useQuery({
    queryKey: ["public-profile", nickname],
    queryFn: () => loadProfile(nickname),
    retry: false,
  });
  const items = useQuery({
    queryKey: ["public-profile-items", profile.data?.id, tab, page],
    queryFn: () => loadProfileItems(profile.data!.id, tab, page),
    enabled: !!profile.data,
  });
  const href = (nextTab: string, nextPage = 0) =>
    `/@${encodeURIComponent(nickname)}?${new URLSearchParams({ tab: nextTab, page: String(nextPage) })}`;

  if (profile.isPending) return <p>프로필 불러오는 중…</p>;
  if (profile.isError)
    return (
      <section role="alert">
        <h1>
          {profile.error instanceof ApiError && profile.error.status === 404
            ? "프로필을 찾을 수 없습니다."
            : "프로필을 불러오지 못했습니다."}
        </h1>
        <button onClick={() => profile.refetch()}>다시 시도</button>
      </section>
    );
  const data = profile.data;
  return (
    <div className="space-y-6">
      <header className="space-y-3 rounded-lg border border-border-subtle bg-surface p-6">
        <h1 className="text-h1 font-semibold">{data.nickname}</h1>
        <p>
          글 {data.postCount} · 댓글 {data.commentCount}
        </p>
        {data.representativeBadge && (
          <div>
            <span className="text-xs text-text-muted">최근 글의 배지</span>
            <AnimalBadge badge={data.representativeBadge} />
          </div>
        )}
        {member?.id === data.id && (
          <Link href="/mypage" className="font-semibold text-brand">
            마이페이지
          </Link>
        )}
      </header>
      <section className="rounded-lg border border-border-subtle p-5">
        <h2 className="font-semibold">공개 보유 정보</h2>
        <p className="text-sm text-text-muted">정확한 수량과 지갑 주소는 공개하지 않습니다.</p>
        <ul className="mt-3 space-y-2">
          {data.assets.map((asset) => (
            <li key={asset.coinSymbol}>
              <b>
                {asset.coinName} · {asset.coinSymbol}
              </b>{" "}
              · {asset.quantityBand} · {holdingPeriodLabel(asset.holdingMonths)}
              {asset.syncStatus === "PARTIAL" && <span> · 일부 조회 기준</span>}
            </li>
          ))}
        </ul>
        {data.assets.length === 0 && (
          <p className="mt-3 text-text-muted">공개된 보유 정보가 없습니다.</p>
        )}
      </section>
      <nav className="flex gap-5" aria-label="프로필 활동">
        <Link href={href("posts")} aria-current={tab === "posts" ? "page" : undefined}>
          작성한 글
        </Link>
        <Link href={href("comments")} aria-current={tab === "comments" ? "page" : undefined}>
          댓글
        </Link>
      </nav>
      {items.isPending ? (
        <p>활동 불러오는 중…</p>
      ) : items.isError ? (
        <button onClick={() => items.refetch()}>활동 재시도</button>
      ) : (
        <section className="space-y-3">
          <ul className="space-y-3">
            {items.data.items.map((item) => (
              <li key={item.id} className="rounded border border-border-subtle p-4">
                <Link
                  href={`${postHref(item.coinSymbol, item.postId ?? item.id)}${tab === "comments" ? `#comment-${item.id}` : ""}`}
                  className="font-semibold text-brand"
                >
                  {item.title ?? item.postTitle ?? "글 보기"}
                </Link>
                <p className="mt-2 whitespace-pre-wrap break-words">{item.content}</p>
                {item.holderSnapshot && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <AnimalBadge badge={item.holderSnapshot.badge} />
                    <span>
                      작성 시점 · {item.holderSnapshot.quantityBand ?? ""} ·{" "}
                      {holdingPeriodLabel(item.holderSnapshot.holdingMonths)}
                      {item.holderSnapshot.syncStatus === "PARTIAL" ? " · 일부 조회 기준" : ""}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {items.data.items.length === 0 && (
            <p>작성한 {tab === "posts" ? "글" : "댓글"}이 없습니다.</p>
          )}
          <nav className="flex gap-4" aria-label="활동 페이지">
            {page > 0 && <Link href={href(tab, page - 1)}>이전</Link>}
            <span>
              {page + 1} / {Math.max(1, items.data.totalPages)}
            </span>
            {page + 1 < items.data.totalPages && <Link href={href(tab, page + 1)}>다음</Link>}
          </nav>
        </section>
      )}
    </div>
  );
}
