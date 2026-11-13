/**
 * 가짜 서버의 처음 데이터. 배지 · 상태마다 한 건씩 넣어 두어, 화면을 열면 경우가 다 보인다.
 * 숫자와 글은 전부 지어낸 것이다.
 */

const coin = (id, symbol, name, accentColor, extra = {}) => ({
  id,
  symbol,
  name,
  chainType: "EVM",
  accentColor,
  verificationAvailability: "SUPPORTED",
  operationStatus: "OPEN",
  active: true,
  displayOrder: id,
  categoryId: null,
  ...extra,
});

const badge = (name, quantityBand, icon, color, effect) => ({
  version: 1,
  name,
  quantityBand,
  icon,
  color,
  effect,
});

const snapshot = (holderStatus, extra = {}) => ({
  verificationAvailability: "SUPPORTED",
  verificationLevel: holderStatus === "HOLDER" ? "WALLET" : "UNVERIFIED",
  verifiedHolder: holderStatus === "HOLDER",
  walletCount: holderStatus === "NOT_CONNECTED" ? 0 : 1,
  capturedAt: "2026-11-10T03:00:00Z",
  syncStatus: "READY",
  holderStatus,
  ...extra,
});

const WHALE = badge("고래", "100+ ETH", "whale", "gold", "aurora");
const SHARK = badge("상어", "10~100 ETH", "shark", "purple", "flow");
const DOLPHIN = badge("돌고래", "1~10 ETH", "dolphin", "blue", "shine");
const SHRIMP = badge("새우", "0~0.1 ETH", "shrimp", "coral", "none");

/** 글 한 건. `holder` 는 방 코인의 작성 시점 보유 기록이다. */
const post = (id, coinSymbol, nickname, title, holder, minutesAgo) => ({
  id,
  coinSymbol,
  title,
  content: `${title}\n\n가짜 서버가 만든 글입니다. **배지와 상태 표기**를 확인하는 용도입니다.`,
  author: { id: 100 + id, nickname, avatarColor: "#6E56F0" },
  verifiedHolder: holder.verifiedHolder,
  likes: id % 4,
  comments: id === 1 ? 5 : 0,
  liked: false,
  bookmarked: false,
  reposts: 0,
  reposted: false,
  createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  updatedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  media: [],
  holderSnapshot: holder,
  attachedCoinSnapshots: [
    {
      coinSymbol,
      verificationAvailability: holder.verificationAvailability,
      holderStatus: holder.holderStatus,
      verifiedHolder: holder.verifiedHolder,
      quantityBand: holder.quantityBand,
      badge: holder.badge,
      verificationLevel: holder.verificationLevel,
      syncStatus: holder.syncStatus,
      capturedAt: holder.capturedAt,
    },
  ],
});

const comment = (id, nickname, content, holder, minutesAgo, reply = {}) => ({
  id,
  memberId: 200 + id,
  nickname,
  avatarColor: "#6E56F0",
  content,
  createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  updatedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
  holderSnapshot: holder,
  ...reply,
});

export function seed(role) {
  const members = {
    admin: {
      id: 1,
      nickname: "관리자성지",
      avatarColor: "#6E56F0",
      assetVisibility: "RANGE",
      role: "ADMIN",
    },
    user: {
      id: 2,
      nickname: "테스터",
      avatarColor: "#12B76A",
      assetVisibility: "RANGE",
      role: "USER",
    },
  };

  return {
    nextId: 1000,
    members,
    session: role === "GUEST" ? null : role === "USER" ? members.user : members.admin,
    coins: [
      coin(1, "BTC", "Bitcoin", "#F7931A"),
      coin(2, "ETH", "Ethereum", "#627EEA"),
      coin(3, "SOL", "Solana", "#14F195"),
      coin(4, "XRP", "XRP", "#23292F"),
      coin(5, "DOGE", "Dogecoin", "#C2A633", { operationStatus: "CLOSE" }),
      coin(99, "OTHER", "기타", "#64748b", { verificationAvailability: "NOT_SUPPORTED" }),
    ],
    categories: [],
    stats: [
      {
        symbol: "ETH",
        postCount: 7,
        commentCount: 5,
        participantCount: 12,
        verifiedParticipantCount: 3,
        verifiedParticipantRate: 25,
        hotScore: 8,
        activeParticipantCount: 4,
        lastActivityAt: new Date().toISOString(),
      },
      {
        symbol: "BTC",
        postCount: 1,
        commentCount: 0,
        participantCount: 3,
        verifiedParticipantCount: 1,
        verifiedParticipantRate: 33.3,
        hotScore: 2,
        activeParticipantCount: 1,
        lastActivityAt: new Date().toISOString(),
      },
    ],
    posts: [
      post(
        1,
        "ETH",
        "고래형님",
        "동물 배지 · 고래 (오로라 효과)",
        snapshot("HOLDER", { quantityBand: "100+ ETH", badge: WHALE }),
        5,
      ),
      post(
        2,
        "ETH",
        "상어",
        "동물 배지 · 상어 (흐르는 테두리)",
        snapshot("HOLDER", { quantityBand: "10~100 ETH", badge: SHARK }),
        20,
      ),
      post(
        3,
        "ETH",
        "거래소돌고래",
        "동물 배지 · 돌고래 (거래소 연동, 일부 조회)",
        snapshot("HOLDER", {
          verificationLevel: "EXCHANGE",
          quantityBand: "1~10 ETH",
          badge: DOLPHIN,
          syncStatus: "PARTIAL",
        }),
        45,
      ),
      post(
        4,
        "ETH",
        "새우",
        "동물 배지 · 새우 (효과 없음)",
        snapshot("HOLDER", { quantityBand: "0~0.1 ETH", badge: SHRIMP }),
        70,
      ),
      post(5, "ETH", "빈지갑", "모두 확인했고 0개 → ETH 미보유", snapshot("EMPTY"), 90),
      post(6, "ETH", "지갑없음", "지갑을 연결하지 않음 → 미인증", snapshot("NOT_CONNECTED"), 120),
      post(
        7,
        "ETH",
        "조회실패",
        "확인하지 못함 → 조회 실패",
        snapshot("UNKNOWN", { syncStatus: "STALE" }),
        150,
      ),
      post(
        8,
        "BTC",
        "옛글",
        "등급 설정 전의 글 → 예전 지갑연결 배지",
        snapshot("HOLDER", { quantityBand: "0.1~1 BTC" }),
        300,
      ),
    ],
    comments: {
      1: [
        comment(
          1,
          "고래형님",
          "댓글의 동물 배지는 아이콘만, 움직이지 않습니다.",
          snapshot("HOLDER", { badge: WHALE }),
          4,
        ),
        comment(2, "새우", "답글입니다.", snapshot("HOLDER", { badge: SHRIMP }), 3, {
          parentCommentId: 1,
          replyToCommentId: 1,
          replyToNickname: "고래형님",
        }),
        comment(3, "빈지갑", "미보유 댓글", snapshot("EMPTY"), 2),
        comment(4, "지갑없음", "미인증 댓글", snapshot("NOT_CONNECTED"), 2),
        comment(5, "조회실패", "조회 실패 댓글", snapshot("UNKNOWN"), 1),
      ],
    },
    news: [
      {
        id: 1,
        coinSymbol: "ETH",
        title: "가짜 뉴스 제목 — 이더리움 업그레이드 일정",
        summary: "가짜 서버가 넣어 둔 요약입니다. 관리 화면에서 고치거나 지울 수 있습니다.",
        sourceName: "예시 매체",
        sourceUrl: "https://example.com/news/eth",
        createdAt: "2026-11-10T02:00:00Z",
        updatedAt: "2026-11-10T02:00:00Z",
      },
    ],
    polls: [
      {
        id: 10,
        coinSymbol: "ETH",
        question: "오늘 ETH, 오를까 내릴까?",
        active: true,
        choices: [
          { id: 11, label: "오른다" },
          { id: 12, label: "내린다" },
        ],
        votes: {},
      },
    ],
    badgePresets: {
      icons: ["shrimp", "fish", "dolphin", "shark", "whale"],
      colors: ["coral", "mint", "blue", "purple", "gold"],
      effects: ["none", "soft", "border", "shine", "flow", "aurora"],
    },
    badgeConfigs: {
      ETH: {
        symbol: "ETH",
        version: 1,
        tiers: [
          { name: "새우", minimumQuantity: 0, icon: "shrimp", color: "coral", effect: "none" },
          { name: "물고기", minimumQuantity: 0.1, icon: "fish", color: "mint", effect: "soft" },
          { name: "돌고래", minimumQuantity: 1, icon: "dolphin", color: "blue", effect: "shine" },
          { name: "상어", minimumQuantity: 10, icon: "shark", color: "purple", effect: "flow" },
          { name: "고래", minimumQuantity: 100, icon: "whale", color: "gold", effect: "aurora" },
        ],
      },
    },
    banners: [
      {
        id: 1,
        title: "ETH 방 오픈 안내",
        imageUrl: "/api/v1/media/mock-banner-1.png",
        altText: "ETH 방이 열렸습니다",
        linkUrl: "/subhodl/ETH",
        visible: true,
        displayOrder: 0,
      },
      {
        id: 2,
        title: "숨겨 둔 배너",
        imageUrl: "/api/v1/media/mock-banner-2.png",
        altText: "준비 중인 이벤트",
        linkUrl: "",
        visible: false,
        displayOrder: 1,
      },
    ],
  };
}
