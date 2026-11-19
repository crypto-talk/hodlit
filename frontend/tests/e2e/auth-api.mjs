// Deterministic upstream contract fixture; no production account or token is used.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
const sessions = new Map();
const tokens = new Map();
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();
  const refresh = /cryptalk_refresh=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
  const access = /cryptalk_access=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
  const send = (status, value) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(value === undefined ? undefined : JSON.stringify(value));
  };
  if (path === "/health") return send(200, {});
  if (["/api/v1/auth/login", "/api/v1/auth/signup", "/api/v1/auth/refresh"].includes(path)) {
    const member = path.endsWith("refresh")
      ? sessions.get(refresh)
      : {
          id: 1,
          nickname: JSON.parse(body).loginId,
          avatarColor: "#556677",
          walletAddress: null,
          assetVisibility: "PUBLIC",
        };
    if (!member) return send(401, { message: "expired" });
    if (refresh) sessions.delete(refresh);
    const nextRefresh = randomUUID();
    const nextAccess = randomUUID();
    sessions.set(nextRefresh, member);
    tokens.set(nextAccess, member);
    res.setHeader("set-cookie", [
      `cryptalk_access=${nextAccess}; HttpOnly; Path=/; SameSite=Lax; Max-Age=900`,
      `cryptalk_refresh=${nextRefresh}; HttpOnly; Path=/api/v1/auth; SameSite=Lax; Max-Age=1209600`,
    ]);
    return send(200, { member });
  }
  if (path === "/api/v1/auth/logout") {
    sessions.delete(refresh);
    tokens.delete(access);
    res.setHeader("set-cookie", [
      "cryptalk_access=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
      "cryptalk_refresh=; HttpOnly; Path=/api/v1/auth; SameSite=Lax; Max-Age=0",
    ]);
    return send(204);
  }
  if (path === "/api/v1/me") return send(tokens.has(access) ? 200 : 401, tokens.get(access));
  if (path.startsWith("/api/v1/communities")) return send(200, []);
  if (path.startsWith("/api/v1/feed")) return send(200, { items: [], hasMore: false });
  return send(200, []);
});
server.listen(8799, "127.0.0.1");
