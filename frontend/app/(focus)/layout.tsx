import Header from "@/components/layout/header";

/**
 * 헤더만 있는 화면군 (A-3).
 *
 * 로그인·회원가입이 지금 여기 있고, 글쓰기·글수정·설정이 3단계에 들어온다.
 * 사이드바가 없어서 집중을 깨는 것이 없다.
 *
 * `.hd` 래퍼가 `styles/hd.css` 의 스코프다. 화면군마다 한 번씩 감싼다.
 */
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hd min-h-screen">
      <Header />
      <main className="hd-auth">{children}</main>
    </div>
  );
}
