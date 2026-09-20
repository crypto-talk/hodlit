import Logo from "./logo";
import type { SidebarRoom, SidebarWallet } from "./types";

type Props = {
  rooms: SidebarRoom[];
  /** 연결된 지갑 목록. 로그인 전이거나 연결 전이면 빈 배열이다. */
  wallets: SidebarWallet[];
  onConnectWallet: () => void;
};

const changeColor = (change: string) => {
  if (change.startsWith("-")) return "var(--hd-down)";
  if (change.startsWith("+")) return "var(--hd-up)";
  return "var(--hd-sub)";
};

export default function Sidebar({ rooms, wallets, onConnectWallet }: Props) {
  const connected = wallets.length > 0;

  return (
    <div className="hd-sidebar">
      <div className="hd-label">내 코인</div>
      <div className="hd-card text-sm text-text-muted" style={{ marginTop: 8 }}>
        {connected
          ? "보유 중인 코인의 방이 여기 고정됩니다"
          : "지갑을 연결하면 보유 중인 코인의 방이 여기 고정됩니다"}
      </div>

      <div style={{ marginTop: 32, display: "flex", alignItems: "baseline", gap: 8 }}>
        <div className="hd-label" style={{ flex: 1 }}>
          전체 방
        </div>
        <div className="text-xs text-text-muted">24h</div>
      </div>

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column" }}>
        {rooms.map((room) => (
          <a
            key={room.symbol}
            href="#"
            className={`hd-room${room.current ? " hd-room-current" : ""}`}
          >
            <span className="text-sm font-semibold" style={{ flex: "0 0 auto" }}>
              {room.symbol}
            </span>
            <span className="text-sm text-text-muted truncate" style={{ flex: 1, minWidth: 0 }}>
              {room.name}
            </span>
            <span
              className="text-sm tabular-nums"
              style={{ flex: "0 0 auto", color: changeColor(room.change) }}
            >
              {room.change}
            </span>
          </a>
        ))}
      </div>

      <div className="hd-card" style={{ marginTop: 32, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo size={56} background="var(--brand-soft)" foreground="var(--text-primary)" />
        </div>
        <div className="text-h2 font-semibold" style={{ marginTop: 16 }}>
          {connected ? "연결된 지갑" : "지갑을 연결하면"}
        </div>

        {connected ? (
          <div className="hd-cta-list">
            {wallets.map((wallet) => (
              <div key={wallet.id} className="hd-cta-item" style={{ alignItems: "baseline" }}>
                {/* 주소는 앞뒤만 나온다. 축약은 features/wallet 에서 한다. */}
                <span
                  className="text-sm tabular-nums truncate"
                  style={{ flex: 1, minWidth: 0 }}
                  title="연결된 지갑 주소"
                >
                  {wallet.shortAddress}
                </span>
                <span className="text-xs text-text-muted" style={{ flex: "0 0 auto" }}>
                  {wallet.connectedOn}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="hd-cta-list">
            {[
              "글에 보유 배지가 붙습니다",
              "보유 기간이 기록으로 쌓입니다",
              "내 코인 방이 고정됩니다",
            ].map((line) => (
              <div key={line} className="hd-cta-item">
                <span className="hd-dot" />
                <span className="text-sm text-text-muted">{line}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className={`hd-btn hd-btn-block${connected ? "" : " hd-btn-primary"}`}
          style={{ marginTop: 16 }}
          onClick={onConnectWallet}
        >
          {connected ? "지갑 추가" : "지갑 연결"}
        </button>
        <div className="text-xs text-text-muted" style={{ marginTop: 8 }}>
          {connected
            ? "지갑에서 다른 계정을 고르면 추가됩니다"
            : "연결 안 해도 읽고 쓸 수 있습니다"}
        </div>
      </div>

      <div className="hd-sidebar-links">
        <a href="#">커뮤니티 규칙</a>
        <a href="#">의견 보내기</a>
        <a href="#">광고 문의</a>
      </div>
    </div>
  );
}
