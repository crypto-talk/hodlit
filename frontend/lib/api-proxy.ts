import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIES = ["cryptalk_access", "cryptalk_refresh"] as const;
const AUTH = new Set(["login", "signup", "refresh", "logout"]);

/** Transport proxy only. Rust owns cookie issuance, validation, rotation and deletion. */
export async function proxyApi(request: NextRequest, apiUrl: string) {
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
  for (const name of ["content-type", "accept", "origin", "x-hodlit-request", "sec-fetch-site"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const cookies = AUTH_COOKIES.filter(
    (name) => name === "cryptalk_access" || auth === "refresh" || auth === "logout",
  ).flatMap((name) => {
    const value = request.cookies.get(name)?.value;
    return value ? [`${name}=${encodeURIComponent(value)}`] : [];
  });
  if (cookies.length) headers.set("Cookie", cookies.join("; "));

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
      const body = await upstream.clone().json();
      // Fail closed if the proxy is accidentally deployed against the old token-body API.
      if ("accessToken" in body || "refreshToken" in body) {
        throw new Error("Cookie authentication API is required");
      }
    }
    response = new NextResponse(upstream.body, { status: upstream.status });
    const contentType = upstream.headers.get("content-type");
    if (contentType) response.headers.set("content-type", contentType);
    for (const cookie of upstream.headers.getSetCookie()) {
      if (AUTH_COOKIES.some((name) => cookie.startsWith(`${name}=`))) {
        // Preserve Rust's Path, Secure, SameSite and expiry, including deletion on 401.
        response.headers.append("set-cookie", cookie);
      }
    }
  } catch {
    response = NextResponse.json({ message: "API에 연결하지 못했습니다." }, { status: 502 });
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
