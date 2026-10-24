import Header from "@/components/layout/header";

/**
 * 헤더만 있는 화면군 (A-3).
 *
 * 로그인 · 회원가입 · 글쓰기가 여기 있고, 글 수정 · 설정이 들어올 자리다.
 * 사이드바가 없어서 집중을 깨는 것이 없다.
 */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">{children}</main>
    </div>
  );
}
