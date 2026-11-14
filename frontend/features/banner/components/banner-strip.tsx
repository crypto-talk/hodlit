"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BANNERS_QUERY_KEY, loadBanners } from "../api";
import type { Banner } from "../types";

/**
 * 홈 위쪽 배너 (HODL-92). 관리자가 노출로 둔 배너를 정해 둔 순서대로 보인다.
 *
 * - 배너가 없거나, 못 받아 왔거나, 받는 중이면 **아무것도 그리지 않는다.** 배너는 덤이라
 *   빈 칸 · 오류 문구로 본문을 밀어내지 않는다
 * - 이미지가 안 뜨는 배너는 그 한 장만 뺀다
 * - 여러 장이면 한 장씩 넘긴다. 오른쪽 아래의 `< 1 / N >` 로 넘기고, 끝에서 누르면 처음으로
 *   돌아간다. 손가락으로 밀어도 넘어간다(스크롤 스냅). 저절로 넘어가지 않는다 — 읽는 중에
 *   움직이는 것은 방해가 된다
 * - 목록 버튼을 누르면 배너 위에 배너 목록이 펼쳐지고, 같은 자리의 버튼이 닫기(X)로 바뀐다.
 *   고르면 그 배너로 가고 목록은 닫힌다. Esc 로도 닫힌다. 공개 응답에 관리용 제목이 없어 목록에는 대체 텍스트를 쓴다
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
  const [current, setCurrent] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const trackRef = useRef<HTMLUListElement>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const shown = (banners.data ?? []).filter((banner) => !broken.includes(banner.id));
  const count = shown.length;
  const index = Math.min(current, Math.max(count - 1, 0));

  const goTo = useCallback(
    (next: number) => {
      const track = trackRef.current;
      if (!track || count === 0) return;
      const target = ((next % count) + count) % count;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      track.scrollTo({ left: target * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
      setCurrent(target);
    },
    [count],
  );

  const closeList = useCallback(() => {
    setListOpen(false);
    listButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!listOpen) return;
    listRef.current?.querySelector<HTMLButtonElement>("[aria-current='true']")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeList();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listOpen, closeList]);

  if (count === 0) return null;

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== current) setCurrent(next);
  };

  return (
    <section aria-label="배너" aria-roledescription="carousel" className="relative">
      <ul
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((banner, i) => (
          <li
            key={banner.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            aria-hidden={i !== index}
            className="w-full flex-none snap-start"
          >
            <BannerCard
              banner={banner}
              hidden={i !== index}
              onBroken={() => setBroken((ids) => [...ids, banner.id])}
            />
          </li>
        ))}
      </ul>

      {count > 1 ? (
        <div className="absolute right-3 bottom-3 z-30 flex items-center gap-1.5">
          <div
            hidden={listOpen}
            className="flex h-7 items-center rounded-full bg-surface/95 text-text-primary shadow-sm"
          >
            <button
              type="button"
              aria-label="이전 배너"
              onClick={() => goTo(index - 1)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:text-brand"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="min-w-9 text-center text-xs tabular-nums" aria-live="polite">
              <span className="font-semibold">{index + 1}</span>
              <span className="text-text-muted"> / {count}</span>
            </span>
            <button
              type="button"
              aria-label="다음 배너"
              onClick={() => goTo(index + 1)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:text-brand"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <button
            ref={listButtonRef}
            type="button"
            aria-label={listOpen ? "목록 닫기" : "배너 목록"}
            aria-expanded={listOpen}
            aria-controls="banner-list"
            onClick={() => (listOpen ? closeList() : setListOpen(true))}
            className={
              listOpen
                ? "flex size-7 cursor-pointer items-center justify-center rounded-full border border-white/40 text-text-inverse hover:bg-white/10"
                : "flex size-7 cursor-pointer items-center justify-center rounded-full bg-surface/95 text-text-primary shadow-sm hover:text-brand"
            }
          >
            {listOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      ) : null}

      {listOpen ? (
        <div
          id="banner-list"
          role="dialog"
          aria-label="배너 목록"
          className="absolute inset-x-0 top-0 z-20 flex max-h-80 min-h-full rounded-lg bg-text-primary/90 py-3 pr-12 pl-3 backdrop-blur-sm"
        >
          <ul ref={listRef} className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {shown.map((banner, i) => (
              <li key={banner.id}>
                <button
                  type="button"
                  aria-current={i === index}
                  onClick={() => {
                    goTo(i);
                    closeList();
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-left text-sm text-text-inverse hover:bg-white/20 aria-[current=true]:bg-brand"
                >
                  <span className="w-5 shrink-0 text-xs tabular-nums opacity-70">{i + 1}</span>
                  <span className="truncate">{banner.altText || `배너 ${i + 1}`}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const FRAME = "block overflow-hidden rounded-lg border border-border-subtle bg-surface";

function BannerCard({
  banner,
  hidden,
  onBroken,
}: {
  banner: Banner;
  hidden: boolean;
  onBroken: () => void;
}) {
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

  // 화면 밖 배너의 링크는 Tab 순서에서 뺀다. 넘기기는 버튼으로 한다.
  const tabIndex = hidden ? -1 : undefined;

  return banner.link.external ? (
    <a
      href={banner.link.href}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={tabIndex}
      className={FRAME}
    >
      {image}
    </a>
  ) : (
    <Link href={banner.link.href} tabIndex={tabIndex} className={FRAME}>
      {image}
    </Link>
  );
}
