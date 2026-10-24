import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query 설정 (B-5).
 *
 * B-4 에 따라 캐시는 일단 거의 두지 않는다. 캐시 버그는 화면에서 데이터
 * 불일치로만 보여서 추적이 어렵다. 필요해진 쿼리부터 개별로 조인다.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
