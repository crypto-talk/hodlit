"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { BANNERS_QUERY_KEY, loadBanners } from "../api";
import type { Banner } from "../types";

/**
 * 홈 위쪽 배너 (HODL-92). 관리자가 노출로 둔 배너를 정해 둔 순서대로 보인다.
 *
 * - 배너가 없거나, 못 받아 왔거나, 받는 중이면 **아무것도 그리지 않는다.** 배너는 덤이라
 *   빈 칸 · 오류 문구로 본문을 밀어내지 않는다
 * - 이미지가 안 뜨는 배너는 그 한 장만 뺀다
 * - 여러 장이면 가로로 넘긴다(스크롤 스냅). 저절로 넘어가지 않는다 — 읽는 중에 움직이는 것은
 *   방해가 되고, 움직임 줄이기 설정을 따로 챙길 필요도 없어진다. 키보드는 Tab 으로 다음 배너의
 *   링크에 가면 그 배너가 화면에 들어온다
 * - 링크가 없는 배너는 누를 수 없는 그림이다. 바깥 링크는 새 탭 + `noopener noreferrer`
 *
 * 그림 비율은 16:5 로 고정한다. 비율이 다른 이미지는 가운데를 기준으로 잘린다.
 */
export default function BannerStrip() {
  const banners = useQuery({
    queryKey: BANNERS_QUERY_KEY,
    queryFn: loadBanners,
    // 실패해도 다시 조르지 않는다. 다음에 화면을 열 때 다시 받는다.
    retry: false,
    staleTime: 60_000,
  });
  const [broken, setBroken] = useState<number[]>([]);

  const shown = (banners.data ?? []).filter((banner) => !broken.includes(banner.id));
  if (shown.length === 0) return null;

  return (
    <section aria-label="배너">
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-lg">
        {shown.map((banner) => (
          <li key={banner.id} className="w-full flex-none snap-start">
            <BannerCard banner={banner} onBroken={() => setBroken((ids) => [...ids, banner.id])} />
          </li>
        ))}
      </ul>
      {shown.length > 1 ? (
        <p className="mt-1 text-right text-xs text-text-subtle">
          배너 {shown.length}장 · 옆으로 넘겨 보세요
        </p>
      ) : null}
    </section>
  );
}

const FRAME = "block overflow-hidden rounded-lg border border-border-subtle bg-surface";

function BannerCard({ banner, onBroken }: { banner: Banner; onBroken: () => void }) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- 백엔드 미디어 서버의 원본. next/image 원격 설정 전
    <img
      src={banner.src}
      alt={banner.altText}
      onError={onBroken}
      className="aspect-[16/5] w-full object-cover"
    />
  );

  if (!banner.link) return <div className={FRAME}>{image}</div>;

  return banner.link.external ? (
    <a href={banner.link.href} target="_blank" rel="noopener noreferrer" className={FRAME}>
      {image}
    </a>
  ) : (
    <Link href={banner.link.href} className={FRAME}>
      {image}
    </Link>
  );
}
