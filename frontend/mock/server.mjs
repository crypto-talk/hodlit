/**
 * 로컬 화면 확인용 가짜 API 서버. 의존성 없이 Node 만으로 돈다.
 *
 *   pnpm dev:mock        → 이 서버(8787) + next dev 를 같이 띄운다
 *   pnpm mock            → 이 서버만
 *
 * 실제 백엔드를 흉내 낸 것이 아니라 **화면을 눌러 보기 위한 최소한**이다. 값은 메모리에만 있어
 * 서버를 끄면 처음 상태로 돌아간다. 응답 모양은 `lib/api-schema.ts` 와 `docs/*.md` 를 따랐지만,
 * 서버 쪽 검사(길이 · 권한 · 동시성)는 대부분 없다 — 여기서 된다고 실제 API 에서 되는 것은 아니다.
 *
 * 로그인: 아이디에 `admin` 을 넣으면 관리자, 그 밖의 아이디는 일반 회원이다. 비밀번호는 보지 않는다.
 * 처음에는 관리자로 로그인된 상태다(`MOCK_ROLE=USER` · `GUEST` 로 바꿀 수 있다).
 */
import { createServer } from "node:http";
import { seed } from "./seed.mjs";

const PORT = Number(process.env.MOCK_PORT ?? 8787);
const state = seed(process.env.MOCK_ROLE ?? "ADMIN");

/** 가장 작은 PNG(1×1). 올린 이미지 자리에 돌려준다. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const routes = [];
const on = (method, pattern, handler) => {
  const names = [];
  const source = pattern.replace(/:([a-zA-Z]+)/g, (_, name) => {
    names.push(name);
    return "([^/]+)";
  });
  routes.push({ method, regex: new RegExp(`^/api/v1${source}$`), names, handler });
};

const page = (items, query) => {
  const size = Math.min(100, Math.max(1, Number(query.get("size") ?? 20)));
  const number = Math.max(0, Number(query.get("page") ?? 0));
  const totalPages = Math.ceil(items.length / size);
  return {
    items: items.slice(number * size, number * size + size),
    page: number,
    size,
    totalElements: items.length,
    totalPages,
    hasNext: number + 1 < totalPages,
    hasPrevious: number > 0,
  };
};

const member = () => {
  if (!state.session) throw new HttpError(401, "로그인이 필요합니다.");
  return state.session;
};
const admin = () => {
  if (member().role !== "ADMIN") throw new HttpError(403, "관리자 권한이 필요합니다.", "FORBIDDEN");
  return state.session;
};
const room = (symbol) => {
  const found = state.coins.find((coin) => coin.symbol === symbol.toUpperCase() && coin.active);
  if (!found) throw new HttpError(404, "방을 찾을 수 없습니다.");
  return found;
};
const openRoom = (symbol) => {
  const found = room(symbol);
  if (found.operationStatus === "CLOSE")
    throw new HttpError(403, "현재 닫힌 방입니다.", "ROOM_CLOSED");
  return found;
};
const publicCoin = (coin) => {
  const copy = { ...coin };
  delete copy.active;
  delete copy.displayOrder;
  return copy;
};
const auth = () => ({ accessToken: "mock-access-token", member: member() });
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// ── 인증 · 내 정보 ────────────────────────────────────────────────────────────
on("POST", "/auth/refresh", () => auth());
on("POST", "/auth/login", ({ body }) => {
  state.session = state.members[String(body.loginId).includes("admin") ? "admin" : "user"];
  return auth();
});
on("POST", "/auth/signup", ({ body }) => {
  state.session = { ...state.members.user, nickname: body.nickname ?? "새회원" };
  return auth();
});
on("POST", "/auth/logout", () => {
  state.session = null;
});
on("GET", "/me", () => member());
on("PATCH", "/me", ({ body }) => Object.assign(member(), { nickname: body.nickname }));
on("GET", "/me/wallets", () => (member(), []));
on("GET", "/me/exchanges", () => (member(), []));
on("GET", "/me/bookmarks/page", ({ query }) => (member(), page([], query)));
on("GET", "/me/asset-visibility", () => (member(), []));
on("GET", "/me/assets", () => {
  member();
  return { walletCount: 0, exchangeCount: 0, assets: [], unresolvedAssets: [] };
});
on("GET", "/drafts", () => (member(), []));

// ── 방 · 글 · 댓글 ────────────────────────────────────────────────────────────
on("GET", "/coins", () => state.coins.filter((coin) => coin.active).map(publicCoin));
on("GET", "/room-categories", () => state.categories);
on("GET", "/communities/stats", () => ({ window: "24h", rooms: state.stats }));
// 방 통계(HODL-112). 누적은 24시간 값을 부풀린 것이고, 활동이 없는 방은 0 으로 채운 한 줄이다.
on("GET", "/communities/:symbol/stats", ({ params, query }) => {
  const coin = room(params.symbol);
  const window = query.get("window") ?? "24h";
  if (window !== "24h" && window !== "all") throw new HttpError(400, "지원하지 않는 기간입니다.");
  const recent = state.stats.find((item) => item.symbol === coin.symbol);
  const count = (recent?.participantCount ?? 0) * (window === "all" ? 9 : 1);
  const verified = (recent?.verifiedParticipantCount ?? 0) * (window === "all" ? 7 : 1);
  return {
    window,
    until: new Date().toISOString(),
    rooms: [
      {
        ...recent,
        symbol: coin.symbol,
        participantCount: count,
        verifiedParticipantCount: verified,
        verifiedParticipantRate: count ? Math.round((verified / count) * 1000) / 10 : 0,
      },
    ],
  };
});
// 닫힌 방도 200 이다(글 수는 0). 화면은 coin.operationStatus 로 닫힌 방 안내를 그린다.
on("GET", "/communities/:symbol", ({ params }) => {
  const coin = room(params.symbol);
  const closed = coin.operationStatus === "CLOSE";
  return {
    coin: publicCoin(coin),
    postCount: closed ? 0 : state.posts.filter((post) => post.coinSymbol === coin.symbol).length,
  };
});
on("GET", "/communities/:symbol/posts/page", ({ params, query }) => {
  const coin = openRoom(params.symbol);
  const verified = query.get("verified") === "true";
  return page(
    state.posts.filter(
      (post) => post.coinSymbol === coin.symbol && (!verified || post.verifiedHolder),
    ),
    query,
  );
});
on("GET", "/feed", () => ({
  items: state.posts.map((post) => ({ eventType: "POST", post })),
  hasMore: false,
}));
on("GET", "/posts/:id", ({ params }) => {
  const post = state.posts.find((item) => item.id === Number(params.id));
  if (!post) throw new HttpError(404, "글을 찾을 수 없습니다.");
  return post;
});
on("GET", "/posts/:id/comments", ({ params }) => state.comments[params.id] ?? []);

// ── 검색 (HODL-99) ───────────────────────────────────────────────────────────
// 검색어가 들어 있는지만 본다(대소문자 무시). 닫힌 방의 글 · 댓글은 뺀다. 관련도 정렬은 흉내 내지 않는다.
const SEARCH_TYPES = { posts: "POST", comments: "COMMENT", rooms: "ROOM", users: "USER" };
const searchItems = (q, symbol) => {
  const needle = String(q ?? "")
    .trim()
    .toLowerCase();
  if (!needle || needle.length > 100) throw new HttpError(400, "검색어는 1~100자여야 합니다.");
  const has = (...texts) =>
    texts.some((text) =>
      String(text ?? "")
        .toLowerCase()
        .includes(needle),
    );
  const open = (coinSymbol) =>
    state.coins.some(
      (coin) => coin.symbol === coinSymbol && coin.active && coin.operationStatus !== "CLOSE",
    ) &&
    (!symbol || coinSymbol === symbol);

  const posts = state.posts.filter((post) => open(post.coinSymbol));
  const items = [];
  for (const post of posts) {
    if (has(post.title, post.content, post.author.nickname))
      items.push({
        type: "POST",
        id: post.id,
        label: post.title,
        excerpt: post.content.slice(0, 200),
        authorNickname: post.author.nickname,
        roomSymbol: post.coinSymbol,
        postId: post.id,
        createdAt: post.createdAt,
      });
    for (const comment of state.comments[post.id] ?? []) {
      if (has(comment.content, comment.nickname))
        items.push({
          type: "COMMENT",
          id: comment.id,
          label: post.title,
          excerpt: comment.content.slice(0, 200),
          authorNickname: comment.nickname,
          roomSymbol: post.coinSymbol,
          postId: post.id,
          createdAt: comment.createdAt,
        });
    }
  }
  if (symbol) return items;

  for (const coin of state.coins) {
    if (coin.active && coin.operationStatus !== "CLOSE" && has(coin.symbol, coin.name))
      items.push({ type: "ROOM", id: coin.id, label: coin.name, roomSymbol: coin.symbol });
  }
  const users = new Map(posts.map((post) => [post.author.id, post.author.nickname]));
  for (const [id, nickname] of users) {
    if (has(nickname)) items.push({ type: "USER", id, label: nickname });
  }
  return items;
};
const searchList = (query, symbol) => {
  const type = query.get("type");
  const allowed = symbol ? ["posts", "comments"] : Object.keys(SEARCH_TYPES);
  if (type && !allowed.includes(type)) throw new HttpError(400, "지원하지 않는 분류입니다.");
  const items = searchItems(query.get("q"), symbol);
  return page(type ? items.filter((item) => item.type === SEARCH_TYPES[type]) : items, query);
};
const searchGroups = (query, symbol) => {
  const items = searchItems(query.get("q"), symbol);
  const preview = new URLSearchParams({ size: query.get("previewSize") ?? "5" });
  const kinds = symbol ? ["posts", "comments"] : Object.keys(SEARCH_TYPES);
  return Object.fromEntries(
    kinds.map((kind) => [
      kind,
      page(
        items.filter((item) => item.type === SEARCH_TYPES[kind]),
        preview,
      ),
    ]),
  );
};
on("GET", "/search", ({ query }) => searchList(query, null));
on("GET", "/search/groups", ({ query }) => searchGroups(query, null));
on("GET", "/communities/:symbol/search", ({ params, query }) =>
  searchList(query, openRoom(params.symbol).symbol),
);
on("GET", "/communities/:symbol/search/groups", ({ params, query }) =>
  searchGroups(query, openRoom(params.symbol).symbol),
);

// ── 방 뉴스 ──────────────────────────────────────────────────────────────────
on("GET", "/communities/:symbol/news", ({ params, query }) => {
  const coin = openRoom(params.symbol);
  return page(
    state.news.filter((item) => item.coinSymbol === coin.symbol),
    query,
  );
});
on("POST", "/communities/:symbol/news", ({ params, body }) => {
  admin();
  const now = new Date().toISOString();
  const item = {
    id: state.nextId++,
    coinSymbol: openRoom(params.symbol).symbol,
    ...body,
    createdAt: now,
    updatedAt: now,
  };
  state.news.unshift(item);
  return [201, item];
});
on("PUT", "/news/:id", ({ params, body }) => {
  admin();
  const item = state.news.find((news) => news.id === Number(params.id));
  if (!item) throw new HttpError(404, "뉴스를 찾을 수 없습니다.");
  return Object.assign(item, body, { updatedAt: new Date().toISOString() });
});
on("DELETE", "/news/:id", ({ params }) => {
  admin();
  state.news = state.news.filter((news) => news.id !== Number(params.id));
});

// ── 일일 투표 ────────────────────────────────────────────────────────────────
const pollView = (poll) => {
  const voted = state.session ? poll.votes[`${state.session.id}:${today()}`] : undefined;
  const counts = Object.entries(poll.votes)
    .filter(([key]) => key.endsWith(today()))
    .map(([, choiceId]) => choiceId);
  return {
    id: poll.id,
    coinSymbol: poll.coinSymbol,
    question: poll.question,
    active: poll.active,
    day: today(),
    participatedToday: voted !== undefined,
    // 오늘 참여하기 전에는 집계 필드가 아예 빠진다(실제 서버와 같다).
    ...(voted === undefined
      ? { choices: poll.choices.map(({ id, label }) => ({ id, label })) }
      : {
          userChoiceId: voted,
          totalVotes: counts.length,
          choices: poll.choices.map(({ id, label }) => ({
            id,
            label,
            voteCount: counts.filter((choiceId) => choiceId === id).length,
          })),
        }),
  };
};
on("GET", "/communities/:symbol/poll", ({ params }) => {
  const coin = openRoom(params.symbol);
  const poll = state.polls.find((item) => item.coinSymbol === coin.symbol && item.active);
  if (!poll) throw new HttpError(404, "진행 중인 투표가 없습니다.");
  return pollView(poll);
});
on("POST", "/communities/:symbol/polls", ({ params, body }) => {
  admin();
  const coin = openRoom(params.symbol);
  for (const poll of state.polls) if (poll.coinSymbol === coin.symbol) poll.active = false;
  const poll = {
    id: state.nextId++,
    coinSymbol: coin.symbol,
    question: body.question,
    active: true,
    choices: body.choices.map((label) => ({ id: state.nextId++, label })),
    votes: {},
  };
  state.polls.push(poll);
  return [201, pollView(poll)];
});
on("POST", "/polls/:id/close", ({ params }) => {
  admin();
  const poll = state.polls.find((item) => item.id === Number(params.id));
  if (!poll) throw new HttpError(404, "투표를 찾을 수 없습니다.");
  poll.active = false;
});
on("POST", "/polls/:id/votes", ({ params, body }) => {
  const poll = state.polls.find((item) => item.id === Number(params.id));
  if (!poll) throw new HttpError(404, "투표를 찾을 수 없습니다.");
  if (!poll.active) throw new HttpError(409, "종료된 투표입니다.");
  const key = `${member().id}:${today()}`;
  if (poll.votes[key] !== undefined) throw new HttpError(409, "오늘은 이미 참여했습니다.");
  poll.votes[key] = body.choiceId;
  return pollView(poll);
});

// ── 지난 투표 결과 · 내 투표 ──────────────────────────────────────────────────
on("GET", "/communities/:symbol/polls/results", ({ params, query }) => {
  const coin = openRoom(params.symbol);
  return page(
    state.pollResults.filter((item) => item.coinSymbol === coin.symbol),
    query,
  );
});
on("GET", "/me/votes", ({ query }) => {
  member();
  return page(state.myVotes, query);
});

// ── 뽑기 이벤트 ──────────────────────────────────────────────────────────────
const drawEvent = (id) => {
  const event = state.drawEvents.find((item) => item.id === Number(id));
  if (!event) throw new HttpError(404, "이벤트를 찾을 수 없습니다.");
  return event;
};
const canDraw = (event) =>
  event.status === "ACTIVE" &&
  Date.now() >= Date.parse(event.startsAt) &&
  Date.now() < Date.parse(event.endsAt);
on("GET", "/draw-events/:id", ({ params }) => {
  const event = drawEvent(params.id);
  return { ...event, canParticipate: canDraw(event) };
});
on("GET", "/draw-events/:id/me", ({ params }) => {
  const result = state.drawResults[`${drawEvent(params.id).id}:${member().id}`];
  return result ? { result: { ...result, existing: true } } : {};
});
on("POST", "/draw-events/:id/draw", ({ params }) => {
  const event = drawEvent(params.id);
  const key = `${event.id}:${member().id}`;
  // 이미 뽑았으면 처음 결과를 그대로 돌려준다(실제 서버와 같다).
  if (state.drawResults[key]) return { ...state.drawResults[key], existing: true };
  if (!canDraw(event)) throw new HttpError(409, "현재 참여할 수 없는 이벤트입니다.");
  const prize = event.prizes[Math.floor(Math.random() * event.prizes.length)];
  state.drawResults[key] = {
    id: state.nextId++,
    eventId: event.id,
    prizeId: prize.id,
    prizeName: prize.name,
    imageUrl: prize.imageUrl,
    capturedAt: new Date().toISOString(),
  };
  return { ...state.drawResults[key], existing: false };
});

// ── 관리자: 방 · 카테고리 · 등급 ──────────────────────────────────────────────
const adminRoom = (coin) => ({
  id: coin.id,
  symbol: coin.symbol,
  name: coin.name,
  active: coin.active,
  operationStatus: coin.operationStatus,
  displayOrder: coin.displayOrder,
  categoryId: coin.categoryId,
});
on("GET", "/admin/access", () => (admin(), {}));
on("GET", "/admin/communities", ({ query }) => {
  admin();
  const q = (query.get("q") ?? "").toLowerCase();
  const status = query.get("operationStatus");
  return page(
    state.coins
      .filter((coin) => !status || coin.operationStatus === status)
      .filter((coin) => !q || `${coin.symbol} ${coin.name}`.toLowerCase().includes(q))
      .map(adminRoom),
    query,
  );
});
on("PATCH", "/admin/communities/:symbol/status", ({ params, body }) => {
  admin();
  const coin = state.coins.find((item) => item.symbol === params.symbol);
  if (!coin) throw new HttpError(404, "방을 찾을 수 없습니다.");
  coin.operationStatus = body.operationStatus;
  return adminRoom(coin);
});
on("PATCH", "/admin/communities/:symbol", ({ params, body }) => {
  admin();
  const coin = state.coins.find((item) => item.symbol === params.symbol);
  if (!coin) throw new HttpError(404, "방을 찾을 수 없습니다.");
  return adminRoom(Object.assign(coin, body));
});
on("GET", "/admin/room-categories", () => (admin(), state.categories));
on("GET", "/admin/badge-presets", () => (admin(), state.badgePresets));
on("GET", "/admin/communities/:symbol/badge-config", ({ params }) => {
  admin();
  return state.badgeConfigs[params.symbol] ?? { symbol: params.symbol, version: 0, tiers: [] };
});
on("PUT", "/admin/communities/:symbol/badge-config", ({ params, body }) => {
  admin();
  const current = state.badgeConfigs[params.symbol] ?? {
    symbol: params.symbol,
    version: 0,
    tiers: [],
  };
  if (body.expectedVersion !== current.version) {
    throw new HttpError(409, "다른 관리자가 먼저 저장했습니다. 새로고침해 주세요.");
  }
  state.badgeConfigs[params.symbol] = {
    symbol: params.symbol,
    version: current.version + 1,
    tiers: body.tiers,
  };
  return state.badgeConfigs[params.symbol];
});
on("GET", "/admin/posts", ({ query }) => (admin(), page([], query)));
on("GET", "/admin/members", ({ query }) => (admin(), page([], query)));
on("GET", "/admin/moderation-logs", ({ query }) => (admin(), page([], query)));

// ── 배너 · 미디어 ────────────────────────────────────────────────────────────
const sortedBanners = () =>
  [...state.banners].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
on("GET", "/banners", () =>
  sortedBanners()
    .filter((banner) => banner.visible)
    .map(({ id, imageUrl, altText, linkUrl, displayOrder }) => ({
      id,
      imageUrl,
      altText,
      ...(linkUrl ? { linkUrl } : {}),
      displayOrder,
    })),
);
on("GET", "/admin/banners", () => (admin(), sortedBanners()));
on("POST", "/admin/banners", ({ body }) => {
  admin();
  const now = new Date().toISOString();
  const banner = { id: state.nextId++, ...body, createdAt: now, updatedAt: now };
  state.banners.push(banner);
  return [201, banner];
});
on("PATCH", "/admin/banners/order", ({ body }) => {
  admin();
  const ids = body.ids ?? [];
  if (ids.length !== state.banners.length)
    throw new HttpError(400, "모든 배너를 한 번씩 보내야 합니다.");
  ids.forEach((id, index) => {
    const banner = state.banners.find((item) => item.id === id);
    if (!banner) throw new HttpError(400, "없는 배너가 들어 있습니다.");
    banner.displayOrder = index;
  });
  return sortedBanners();
});
on("PATCH", "/admin/banners/:id", ({ params, body }) => {
  admin();
  const banner = state.banners.find((item) => item.id === Number(params.id));
  if (!banner) throw new HttpError(404, "배너를 찾을 수 없습니다.");
  return Object.assign(banner, body, { updatedAt: new Date().toISOString() });
});
on("DELETE", "/admin/banners/:id", ({ params }) => {
  admin();
  state.banners = state.banners.filter((banner) => banner.id !== Number(params.id));
});
on("POST", "/media", () => {
  member();
  return [201, { url: `/api/v1/media/mock-${state.nextId++}.png` }];
});
on("DELETE", "/media/:file", () => undefined);
on("GET", "/media/:file", () => PIXEL);

// ── 서버 ─────────────────────────────────────────────────────────────────────
const readBody = (request) =>
  new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      const json = (request.headers["content-type"] ?? "").includes("application/json");
      try {
        resolve(json && text ? JSON.parse(text) : {});
      } catch {
        resolve({});
      }
    });
  });

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  // 브라우저가 쿠키를 싣는 요청(credentials: include)이라 Origin 을 그대로 되돌려 준다.
  response.setHeader("Access-Control-Allow-Origin", request.headers.origin ?? "*");
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  const send = (status, value) => {
    if (Buffer.isBuffer(value)) {
      response.writeHead(status, { "Content-Type": "image/png" }).end(value);
    } else if (value === undefined) {
      response.writeHead(status === 200 ? 204 : status).end();
    } else {
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(value));
    }
  };

  try {
    for (const route of routes) {
      const match = route.method === request.method ? route.regex.exec(url.pathname) : null;
      if (!match) continue;
      const params = Object.fromEntries(
        route.names.map((name, index) => [name, decodeURIComponent(match[index + 1])]),
      );
      const result = await route.handler({
        params,
        query: url.searchParams,
        body: await readBody(request),
      });
      const [status, value] =
        Array.isArray(result) && typeof result[0] === "number" ? result : [200, result];
      console.log(`${status} ${request.method} ${url.pathname}${url.search}`);
      send(status, value);
      return;
    }
    throw new HttpError(404, `가짜 서버에 없는 주소입니다: ${request.method} ${url.pathname}`);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    console.log(`${status} ${request.method} ${url.pathname}${url.search}`);
    send(status, {
      message: error instanceof Error ? error.message : "알 수 없는 오류",
      ...(error instanceof HttpError && error.code ? { code: error.code } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}).listen(PORT, () => {
  console.log(
    `가짜 API 서버: http://localhost:${PORT}  (지금 ${state.session ? state.session.nickname : "로그인 전"})`,
  );
});
