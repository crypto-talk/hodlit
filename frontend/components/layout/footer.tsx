import Logo from "./logo";

export default function Footer() {
  return (
    <footer className="hd-footer">
      <Logo size={24} background="var(--border-subtle)" foreground="var(--text-muted)" />
      <p className="hd-t-xs hd-muted" style={{ flex: 1, minWidth: 240 }}>
        Hodlit의 게시물은 투자 권유가 아니며, 투자 판단과 그 결과의 책임은 이용자 본인에게 있습니다.
        보유 배지는 지갑·거래소 연동 시점의 데이터를 기준으로 표시됩니다.
      </p>
    </footer>
  );
}
