import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DrawView from "@/features/draw/components/draw-view";
import { parsePositiveId } from "@/lib/routes";

export const metadata: Metadata = {
  title: "이벤트",
};

/** 뽑기 이벤트 (HODL-95). id 가 양의 정수가 아니면 요청 없이 404 다. */
export default async function DrawPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const id = parsePositiveId(eventId);
  if (id === null) notFound();
  return <DrawView eventId={id} />;
}
