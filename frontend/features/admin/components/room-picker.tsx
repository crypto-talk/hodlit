"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { loadRoomChoices } from "../api";

type Props = {
  /** 지금 고른 방. 주소의 `?room=` 에서 온다. */
  room: string | null;
  /** 방 심볼 → 그 방을 고른 주소. 고른 방은 주소에 싣는다(구조 규칙 8). */
  hrefFor: (symbol: string) => string;
};

/**
 * 관리자 화면의 방 고르기 칸. 뉴스 관리와 투표 관리가 같이 쓴다.
 *
 * 닫힌 방도 목록에 있다 — 열기 전에 뉴스 · 투표를 준비해 둘 수 있어서다. 닫힌 방에서 서버가
 * 거절하는 동작은 각 화면이 그 응답을 그대로 안내한다.
 */
export default function RoomPicker({ room, hrefFor }: Props) {
  const router = useRouter();
  const rooms = useQuery({ queryKey: ["admin", "room-choices"], queryFn: loadRoomChoices });

  return (
    <label className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold text-text-primary">방</span>
      <NativeSelect
        className="w-60"
        value={room ?? ""}
        disabled={!rooms.data}
        onChange={(event) => {
          if (event.target.value) router.push(hrefFor(event.target.value));
        }}
      >
        <option value="">
          {rooms.isError
            ? "방 목록을 못 불러왔습니다"
            : rooms.data
              ? "방을 고르세요"
              : "불러오는 중…"}
        </option>
        {rooms.data?.map((item) => (
          <option key={item.symbol} value={item.symbol}>
            {item.symbol} · {item.name}
            {item.operationStatus === "CLOSE" ? " (닫힘)" : ""}
          </option>
        ))}
        {/* 주소로 바로 들어온 방이 목록에 없을 때(비활성 등)도 고른 값이 보이게 한다. */}
        {room && rooms.data && !rooms.data.some((item) => item.symbol === room) ? (
          <option value={room}>{room}</option>
        ) : null}
      </NativeSelect>
      {rooms.isError ? (
        <button
          type="button"
          className="text-sm text-brand hover:underline"
          onClick={() => void rooms.refetch()}
        >
          다시 시도
        </button>
      ) : null}
    </label>
  );
}
