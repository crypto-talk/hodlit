"use client";

import { useRouter } from "next/navigation";
import ModerationPanel from "./moderation-panel";

export default function ModerationScreen({
  type,
  q,
  state,
  page,
}: {
  type: "posts" | "members" | "logs";
  q: string;
  state: string;
  page: number;
}) {
  const router = useRouter();
  return (
    <ModerationPanel
      key={`${type}:${q}:${state}`}
      type={type}
      q={q}
      state={state}
      page={page}
      navigate={(query, nextPage, filter) =>
        router.push(
          `/admin/${type}?${new URLSearchParams({ q: query, state: filter, page: String(nextPage) })}`,
        )
      }
    />
  );
}
