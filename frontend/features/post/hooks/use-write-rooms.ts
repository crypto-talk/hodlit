"use client";

import { useQuery } from "@tanstack/react-query";
import { loadWriteRooms } from "../api";

/** 글쓰기 방 목록 쿼리 키. 발행이 `ROOM_CLOSED` 로 막히면 이 키를 무효화해 다시 받는다. */
export const WRITE_ROOMS_KEY = ["write-rooms"] as const;

/**
 * 글쓰기 방 목록 — 닫힌 방까지 전부(`open` 으로 구별).
 *
 * 글쓰기 방 선택 · 임시저장 목록의 "닫힌 방" 표시 · 글 상세와 글 수정의 닫힌 방 안내가 같은
 * 키를 써서 한 번만 받는다.
 */
export function useWriteRooms() {
  return useQuery({ queryKey: WRITE_ROOMS_KEY, queryFn: loadWriteRooms });
}

/** 지금 닫혀 있는 방 심볼. 목록을 못 받았으면 비어 있다 — 표시만 빠지고 막지는 않는다. */
export function useClosedRoomSymbols(): Set<string> {
  const rooms = useWriteRooms();
  return new Set((rooms.data ?? []).filter((room) => !room.open).map((room) => room.symbol));
}
