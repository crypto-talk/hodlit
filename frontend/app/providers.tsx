"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { createQueryClient } from "@/lib/query";
import { SessionProvider } from "@/lib/session";

/**
 * 클라이언트 프로바이더 모음.
 *
 * 루트 레이아웃은 서버 컴포넌트로 남겨야 하므로(구조 규칙 6) `"use client"`
 * 는 이 파일에만 붙인다. 레이아웃은 이걸 렌더하기만 한다.
 *
 * QueryClient 를 모듈 최상단이 아니라 `useState` 안에서 만드는 이유: 서버에서
 * 모듈이 공유되면 요청끼리 캐시가 섞인다.
 *
 * SessionProvider 는 헤더와 페이지가 같은 로그인 상태를 봐야 해서 여기 있다.
 *
 * Toaster 는 토스트가 뜨는 자리 하나다. 행동 실패(지갑 연결 · 투표 · 발행 등)를 알릴 때
 * `toast.error("…")` 로 부른다. 아래 가운데에 띄운다 — 오른쪽 아래는 좁은 화면의 글쓰기 FAB 자리다.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  );
}
