"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { loadRoomNews, roomNewsQueryKey } from "../api";

/**
 * 방 뉴스 한 쪽. 방 게시판 칸(최근 몇 개)과 뉴스 페이지(번호 페이지)가 크기만 달리해 같이 쓴다.
 * 쪽을 넘길 때 앞 쪽을 남겨 두어 목록이 깜빡이지 않게 한다.
 */
export function useRoomNews(symbol: string, page: number, size: number) {
  return useQuery({
    queryKey: roomNewsQueryKey(symbol, page, size),
    queryFn: () => loadRoomNews(symbol, page, size),
    placeholderData: keepPreviousData,
  });
}
