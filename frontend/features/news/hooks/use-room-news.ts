"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { loadRoomNews, roomNewsQueryKey } from "../api";

/** 방 뉴스 한 쪽. 쪽을 넘길 때 앞 쪽을 남겨 두어 칸이 깜빡이지 않게 한다. */
export function useRoomNews(symbol: string, page: number) {
  return useQuery({
    queryKey: roomNewsQueryKey(symbol, page),
    queryFn: () => loadRoomNews(symbol, page),
    placeholderData: keepPreviousData,
  });
}
