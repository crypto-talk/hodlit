import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxyApi } from "@/lib/api-proxy";

const origin = "https://hodlit.example";
const api = "https://api.example";
const member = { id: 1, nickname: "호들러" };

function request(path: string, method = "POST", extra: Record<string, string> = {}) {
  return new NextRequest(`${origin}/api/v1/${path}`, {
    method,
    headers: { origin, "x-hodlit-request": "1", ...extra },
  });
}
function success() {
  return Response.json(
    { accessToken: "access-secret", tokenType: "Bearer", member },
    {
      headers: {
        "set-cookie":
          "cryptalk_refresh=refresh-secret; HttpOnly; Path=/api/v1/auth; Secure; SameSite=None",
      },
    },
  );
}
afterEach(() => vi.unstubAllGlobals());

describe("same-origin authentication BFF", () => {
  it.each(["login", "signup", "refresh"])(
    "%s keeps both tokens in HttpOnly host cookies",
    async (action) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success()));
      const response = await proxyApi(request(`auth/${action}`), api, true);
      expect(await response.json()).toEqual({ member });
      for (const [name, value, age] of [
        ["hodlit_access", "access-secret", 900],
        ["hodlit_refresh", "refresh-secret", 1209600],
      ] as const) {
        expect(response.cookies.get(name)).toMatchObject({
          value,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: age,
        });
        expect(response.cookies.get(name)?.domain).toBeUndefined();
      }
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("local HTTP uses HttpOnly cookies without Secure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success()));
    const response = await proxyApi(request("auth/login"), api, false);
    expect(response.cookies.get("hodlit_access")).toMatchObject({ httpOnly: true, secure: false });
  });

  it("forwards only BFF credentials to the fixed upstream, with no shared cache", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(member));
    vi.stubGlobal("fetch", fetch);
    await proxyApi(
      request("me?sort=recent", "GET", {
        cookie: "hodlit_access=access-secret; hodlit_refresh=refresh-secret; unrelated=private",
        authorization: "Bearer attacker",
      }),
      api,
      true,
    );
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(`${api}/api/v1/me?sort=recent`);
    expect(init.headers.get("authorization")).toBe("Bearer access-secret");
    expect(init.headers.has("cookie")).toBe(false);
    expect(init).toMatchObject({ cache: "no-store", redirect: "manual" });
  });

  it("only refresh/logout receive the upstream refresh cookie", async () => {
    const fetch = vi.fn().mockResolvedValue(success());
    vi.stubGlobal("fetch", fetch);
    await proxyApi(
      request("auth/refresh", "POST", {
        cookie: "hodlit_refresh=refresh-secret; unrelated=private",
      }),
      api,
      true,
    );
    expect(fetch.mock.calls[0][1].headers.get("cookie")).toBe("cryptalk_refresh=refresh-secret");
  });

  it.each<Record<string, string>>([
    { origin: "https://evil.example" },
    { origin: "null" },
    { origin: "" },
    { "x-hodlit-request": "" },
    { "sec-fetch-site": "cross-site" },
  ])("rejects CSRF before contacting the API (%j)", async (headers) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await proxyApi(request("auth/login", "POST", headers), api, true);
    expect(response.status).toBe(403);
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
    const response = await proxyApi(request("me", "GET"), api, true);
    expect(response.status).toBe(502);
    expect(response.headers.has("location")).toBe(false);
  });

  it("clears both cookies on refresh expiry, preserving transient failures", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const expired = await proxyApi(request("auth/refresh"), api, true);
    expect(expired.cookies.get("hodlit_access")?.maxAge).toBe(0);
    expect(expired.cookies.get("hodlit_refresh")?.maxAge).toBe(0);
    const unavailable = await proxyApi(request("auth/refresh"), api, true);
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.has("set-cookie")).toBe(false);
  });

  it("logout clears cookies even during an upstream outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const response = await proxyApi(request("auth/logout"), api, true);
    expect(response.status).toBe(204);
    expect(response.cookies.get("hodlit_access")?.maxAge).toBe(0);
    expect(response.cookies.get("hodlit_refresh")?.maxAge).toBe(0);
  });

  it("rejects incomplete auth responses without exposing a token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ accessToken: "secret", member })),
    );
    const response = await proxyApi(request("auth/login"), api, true);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret");
  });
  it("인코딩된 인증 경로에서도 토큰을 노출하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success()));
    const response = await proxyApi(request("%61uth/login"), api, true);
    expect(await response.json()).toEqual({ member });
    expect(response.cookies.get("hodlit_access")?.httpOnly).toBe(true);
  });

  it.each(["auth%2flogin", "%2561uth/login", "auth/wallet-login"])(
    "모호하거나 허용하지 않는 경로 %s 거부",
    async (path) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      expect((await proxyApi(request(path), api, true)).status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
