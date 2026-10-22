"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/http";
import { useSession } from "@/lib/session";
import { castVote, loadRoomPoll, roomPollQueryKey } from "../api";
import { kstDay, msUntilKstMidnight } from "../kst-day";
import type { RoomPoll } from "../types";

/**
 * 지금의 한국 날짜. 자정이 지나면 바뀐다.
 *
 * 탭이 백그라운드에 있으면 타이머가 늦게 돌 수 있어, 깨어날 때마다 날짜를 다시 계산한다.
 */
export function useKstToday(): string {
  const [today, setToday] = useState(() => kstDay(Date.now()));

  useEffect(() => {
    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      setToday(kstDay(Date.now()));
      timer = window.setTimeout(sync, msUntilKstMidnight(Date.now()) + 500);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}

/**
 * 방의 현재 투표.
 *
 * 쿼리 키에 한국 날짜를 넣었다. 자정이 지나면 키가 바뀌어 어제 결과는 화면에서 바로 사라지고,
 * 새 날짜로 다시 받는다(같은 질문이면 그대로 다시 참여할 수 있다).
 * 로그인 상태에 따라 결과가 달라서 회원 id 도 키에 넣고, 세션 복원이 끝난 뒤에 부른다.
 */
export function useRoomPoll(symbol: string) {
  const { member, restored } = useSession();
  const memberId = member?.id ?? null;
  const today = useKstToday();

  const query = useQuery({
    queryKey: roomPollQueryKey(symbol, memberId, today),
    queryFn: () => loadRoomPoll(symbol),
    enabled: restored,
  });

  return { ...query, today, memberId };
}

/**
 * 투표 참여. 성공하면 응답(결과 포함)을 바로 그리고, 한 번 더 받아 최신 숫자로 맞춘다.
 *
 * - 409(이미 참여 · 종료된 투표): 서버 메시지를 띄우고 다시 받는다
 * - 그 밖의 실패: 오류 토스트. 고른 선택지는 화면에 그대로 둔다(성공한 척하지 않는다)
 */
export function useVote(symbol: string, memberId: number | null, today: string) {
  const queryClient = useQueryClient();
  const key = roomPollQueryKey(symbol, memberId, today);

  return useMutation({
    mutationFn: ({ pollId, choiceId }: { pollId: number; choiceId: number }) =>
      castVote(pollId, choiceId),
    onSuccess: (poll) => {
      queryClient.setQueryData<RoomPoll | null>(key, poll);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast(error.message || "이미 참여했거나 종료된 투표입니다.");
        void queryClient.invalidateQueries({ queryKey: key });
        return;
      }
      toast.error("투표를 반영하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    },
  });
}
