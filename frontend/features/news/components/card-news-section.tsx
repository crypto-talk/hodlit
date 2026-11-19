"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { HomeNewsCard } from "../types";

export default function CardNewsSection({ items }: { items: HomeNewsCard[] }) {
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="card-news-heading">
      <h2 id="card-news-heading" className="text-h1 font-semibold">
        카드뉴스
      </h2>
      <ul className="mt-4 grid items-start gap-4 sm:grid-cols-2">
        {items.map(({ id, symbol, title, summary, sourceName, sourceUrl, cover }) => (
          <li
            key={id}
            className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface"
          >
            <details className="group">
              <summary className="cursor-pointer list-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                {cover && !broken.has(cover) && (
                  // eslint-disable-next-line @next/next/no-img-element -- 원문 출처의 대표 이미지를 직접 표시한다.
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-video w-full bg-surface-muted object-cover"
                    onError={() => setBroken((urls) => new Set(urls).add(cover))}
                  />
                )}
                <span className="block px-4 pt-4 text-xs font-semibold text-text-muted">
                  {symbol}
                  {sourceName && ` · ${sourceName}`}
                </span>
                <span className="flex items-start justify-between gap-3 p-4 pt-1.5">
                  <span className="font-semibold break-words">{title}</span>
                  <ChevronDown
                    aria-hidden
                    className="mt-1 size-4 shrink-0 text-text-muted group-open:rotate-180"
                  />
                </span>
              </summary>
              <div className="border-t border-border-subtle p-4">
                <p className="text-body whitespace-pre-line text-text-primary">{summary}</p>
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand"
                  >
                    원문 보기 <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
