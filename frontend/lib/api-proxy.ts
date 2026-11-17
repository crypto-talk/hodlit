import { NextRequest, NextResponse } from "next/server";

const ACCESS = "hodlit_access";
const REFRESH = "hodlit_refresh";
const AUTH = new Set(["login", "signup", "refresh", "logout"]);

/** Server-only BFF: only the configured API receives credentials. Never follow redirects. */
export async function proxyApi(request: NextRequest, apiUrl: string, secure: boolean) {
  let path: string;
  try {
    path = decodeURIComponent(request.nextUrl.pathname);
  } catch {
    return NextResponse.json({ message: "잘못된 API 경로입니다." }, { status: 400 });
  }
  const auth = path.startsWith("/api/v1/auth/") ? path.slice("/api/v1/auth/".length) : null;
  if (
    !path.startsWith("/api/v1/") ||
    /[%\\]/.test(path) ||
    [...path].some((char) => char.charCodeAt(0) < 32) ||
    /%2f|%5c/i.test(request.nextUrl.pathname) ||
    path.split("/").some((part) => part === "." || part === "..") ||
    (auth && !AUTH.has(auth))
  ) {
    return NextResponse.json({ message: "허용되지 않은 API 경로입니다." }, { status: 400 });
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    // A custom header prevents simple form requests. Origin blocks sibling-subdomain attacks.
    if (
      request.headers.get("origin") !== request.nextUrl.origin ||
      request.headers.get("x-hodlit-request") !== "1" ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return NextResponse.json({ message: "요청 출처를 확인할 수 없습니다." }, { status: 403 });
    }
  }
  if (auth && request.method !== "POST") {
    return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
  }

  const headers = new Headers();
  for (const name of ["content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const access = request.cookies.get(ACCESS)?.value;
  if (access && !auth) headers.set("Authorization", `Bearer ${access}`);
  const refresh = request.cookies.get(REFRESH)?.value;
  if (refresh && (auth === "refresh" || auth === "logout")) {
    headers.set("Cookie", `cryptalk_refresh=${encodeURIComponent(refresh)}`);
  }

  const cookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  const clear = (response: NextResponse) => {
    response.cookies.set(ACCESS, "", { ...cookieOptions, maxAge: 0 });
    response.cookies.set(REFRESH, "", { ...cookieOptions, maxAge: 0 });
  };
  let response: NextResponse;
  try {
    const target = new URL(apiUrl);
    target.pathname = path;
    target.search = request.nextUrl.search;
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      throw new Error("API redirect rejected");
    }
    if (auth && upstream.ok && auth !== "logout") {
      const body = await upstream.json();
      const refreshCookie = upstream.headers
        .getSetCookie()
        .find((value) => value.startsWith("cryptalk_refresh="));
      const token = refreshCookie?.split(";", 1)[0].slice("cryptalk_refresh=".length);
      if (typeof body.accessToken !== "string" || !token || !body.member) {
        throw new Error("Invalid upstream authentication response");
      }
      // Whitelist response fields: neither token nor future credential fields may reach JS.
      response = NextResponse.json({ member: body.member });
      response.cookies.set(ACCESS, body.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
      response.cookies.set(REFRESH, decodeURIComponent(token), {
        ...cookieOptions,
        maxAge: 14 * 86400,
      });
    } else {
      response = new NextResponse(upstream.body, { status: upstream.status });
      const contentType = upstream.headers.get("content-type");
      if (contentType) response.headers.set("content-type", contentType);
      if (auth === "refresh" && upstream.status === 401) clear(response);
    }
  } catch {
    response = NextResponse.json({ message: "API에 연결하지 못했습니다." }, { status: 502 });
  }
  // Local logout always clears browser credentials, even when revocation is unavailable.
  if (auth === "logout") {
    // Report local logout success. Upstream refresh revocation is best effort on outages.
    response = new NextResponse(null, { status: 204 });
    clear(response);
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
