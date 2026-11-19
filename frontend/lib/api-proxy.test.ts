import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxyApi } from "@/lib/api-proxy";

const origin = "https://hodlit.example";
const api = "https://api.example";
const member = { id: 1, nickname: "호들러" };
const accessCookie =
  "cryptalk_access=access-secret; Path=/; HttpOnly; SameSite=Lax; Max-Age=900; Secure";
const refreshCookie =
  "cryptalk_refresh=refresh-secret; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Max-Age=1209600; Secure";

function request(path: string, method = "POST", extra: Record<string, string> = {}) {
  return new NextRequest(`${origin}/api/v1/${path}`, {
    method,
    headers: { origin, "x-hodlit-request": "1", ...extra },
  });
}
function success() {
  const response = Response.json({ member });
  response.headers.append("set-cookie", accessCookie);
  response.headers.append("set-cookie", refreshCookie);
  return response;
}
afterEach(() => vi.unstubAllGlobals());

describe("Rust cookie authentication transport proxy", () => {
  it.each(["login", "signup", "refresh"])(
    "%s passes Rust's response and cookie attributes unchanged",
    async (action) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success()));
      const response = await proxyApi(request(`auth/${action}`), api);
      expect(await response.json()).toEqual({ member });
      expect(response.headers.getSetCookie()).toEqual([accessCookie, refreshCookie]);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("only the fixed API receives access cookies and browser Origin/CSRF metadata", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(member));
    vi.stubGlobal("fetch", fetch);
    await proxyApi(
      request("me?sort=recent", "GET", {
        cookie: "cryptalk_access=access-secret; cryptalk_refresh=refresh-secret; unrelated=private",
        authorization: "Bearer attacker",
      }),
      api,
    );
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(`${api}/api/v1/me?sort=recent`);
    expect(init.headers.has("authorization")).toBe(false);
    expect(init.headers.get("cookie")).toBe("cryptalk_access=access-secret");
    expect(init.headers.get("origin")).toBe(origin);
    expect(init.headers.get("x-hodlit-request")).toBe("1");
    expect(init).toMatchObject({ cache: "no-store", redirect: "manual" });
  });

  it("only refresh/logout receive the refresh cookie", async () => {
    const fetch = vi.fn().mockResolvedValue(success());
    vi.stubGlobal("fetch", fetch);
    await proxyApi(
      request("auth/refresh", "POST", {
        cookie: "cryptalk_refresh=refresh-secret; unrelated=private",
      }),
      api,
    );
    expect(fetch.mock.calls[0][1].headers.get("cookie")).toBe("cryptalk_refresh=refresh-secret");
  });

  it.each<Record<string, string>>([
    { origin: "https://evil.example" },
    { origin: "null" },
    { origin: "" },
    { "x-hodlit-request": "" },
    { "sec-fetch-site": "cross-site" },
  ])("rejects CSRF at the transport boundary (%j)", async (headers) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await proxyApi(request("auth/login", "POST", headers), api)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not follow redirects carrying credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { status: 302, headers: { location: "https://evil.example" } }),
        ),
    );
    const response = await proxyApi(request("me", "GET"), api);
    expect(response.status).toBe(502);
    expect(response.headers.has("location")).toBe(false);
  });

  it("passes Rust's deletion cookies on refresh expiry", async () => {
    const upstream = new Response(null, { status: 401 });
    const deletion = [
      accessCookie.replace("access-secret", "").replace("900", "0"),
      refreshCookie.replace("refresh-secret", "").replace("1209600", "0"),
    ];
    for (const cookie of deletion) upstream.headers.append("set-cookie", cookie);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream));
    const response = await proxyApi(request("auth/refresh"), api);
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual(deletion);
  });

  it("upstream logout failure stays a failure and does not manufacture cookie deletion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const response = await proxyApi(request("auth/logout"), api);
    expect(response.status).toBe(502);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("rejects the old token-body API before exposing tokens or setting cookies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ accessToken: "secret", member })),
    );
    const response = await proxyApi(request("auth/login"), api);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret");
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("recognizes encoded authentication paths", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success()));
    expect(await (await proxyApi(request("%61uth/login"), api)).json()).toEqual({ member });
  });

  it.each(["auth%2flogin", "%2561uth/login", "auth/wallet-login"])(
    "rejects ambiguous or excluded path %s",
    async (path) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      expect((await proxyApi(request(path), api)).status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
