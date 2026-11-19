import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  vi.stubGlobal("navigator", {});
});
afterEach(() => vi.unstubAllGlobals());

it("restores from /me without requiring an auth response token", async () => {
  const member = { id: 1, nickname: "member" };
  const fetch = vi.fn().mockResolvedValue(Response.json(member));
  vi.stubGlobal("fetch", fetch);
  const { refreshSession } = await import("@/lib/api");
  await expect(refreshSession()).resolves.toEqual(member);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/me");
});

it("only an expired session is treated as logged out", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
  const { refreshSession } = await import("@/lib/api");
  await expect(refreshSession()).resolves.toBeNull();
});

it.each([403, 503])("restoration keeps status %s visible", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
  const { refreshSession } = await import("@/lib/api");
  await expect(refreshSession()).rejects.toMatchObject({ status });
});
