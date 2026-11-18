import { expect, test, type Page } from "@playwright/test";

async function call(page: Page, path: string, method = "GET") {
  return page.evaluate(
    async ({ path, method }) => {
      const response = await fetch(`/api/v1/${path}`, {
        method,
        headers: { "X-Hodlit-Request": "1" },
        credentials: "include",
      });
      return { status: response.status, body: await response.text() };
    },
    { path, method },
  );
}

for (const mode of ["login", "signup"] as const) {
  test(`${mode}: HttpOnly cookies, reload/new-tab restoration, refresh and logout`, async ({
    page,
    context,
    request,
  }) => {
    const firstUser = `${mode}-${Date.now()}`;
    const secondUser = `other-${Date.now()}`;
    if (mode === "login") {
      expect(
        (
          await request.post("/api/v1/auth/signup", {
            headers: { Origin: "http://localhost:3109", "X-Hodlit-Request": "1" },
            data: { loginId: firstUser, nickname: firstUser, password: "password-123" },
          })
        ).ok(),
      ).toBe(true);
    }
    await page.addInitScript(() => sessionStorage.setItem("cryptalk_access", "legacy"));
    await page.goto(`/${mode}?next=/login`);
    await page.getByLabel("아이디", { exact: true }).fill(firstUser);
    await page.getByLabel("비밀번호", { exact: true }).fill("password-123");
    if (mode === "signup") await page.getByLabel("닉네임", { exact: true }).fill(firstUser);
    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith(`/api/v1/auth/${mode}`),
    );
    await page
      .getByRole("button", { name: mode === "login" ? "로그인" : "계정 만들기", exact: true })
      .click();
    const response = await responsePromise;
    expect(await response.json()).toMatchObject({ member: { nickname: firstUser } });
    expect(await response.text()).not.toMatch(/accessToken|refreshToken/);
    expect((await call(page, "me")).status).toBe(200);
    const cookies = (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith("cryptalk_"),
    );
    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toMatch(
      /cryptalk_access|cryptalk_refresh/,
    );
    expect(await page.evaluate(() => sessionStorage.getItem("cryptalk_access"))).toBeNull();

    await page.reload();
    await expect(page.getByRole("link", { name: firstUser, exact: true })).toBeVisible();
    expect((await call(page, "me")).status).toBe(200);
    const tab = await context.newPage();
    await tab.goto("/login");
    expect((await call(tab, "me")).status).toBe(200);

    await context.clearCookies({ name: "cryptalk_access" });
    // Reload runs session restoration through http(), which must refresh and retry /me.
    const refreshed = Promise.race(
      [page, tab].map((view) =>
        view.waitForResponse((r) => r.url().endsWith("/api/v1/auth/refresh") && r.status() === 200),
      ),
    );
    await Promise.all([page.reload(), tab.reload()]);
    await refreshed;
    await expect.poll(async () => (await call(page, "me")).status).toBe(200);

    const csrf = await page.evaluate(
      async () => (await fetch("/api/v1/auth/logout", { method: "POST" })).status,
    );
    expect(csrf).toBe(403);
    expect((await call(page, "me")).status).toBe(200);
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page.getByRole("link", { name: firstUser, exact: true })).toHaveCount(0);
    await expect(tab.getByRole("link", { name: firstUser, exact: true })).toHaveCount(0);
    expect((await call(page, "me")).status).toBe(401);
    expect((await context.cookies()).filter((c) => c.name.startsWith("cryptalk_"))).toHaveLength(0);
    expect(
      (
        await request.post("/api/v1/auth/signup", {
          headers: { Origin: "http://localhost:3109", "X-Hodlit-Request": "1" },
          data: { loginId: secondUser, nickname: secondUser, password: "password-123" },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/login");
    await page.getByLabel("아이디", { exact: true }).fill(secondUser);
    await page.getByLabel("비밀번호", { exact: true }).fill("password-123");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.getByRole("link", { name: secondUser, exact: true })).toBeVisible();
    await expect(tab.getByRole("link", { name: secondUser, exact: true })).toBeVisible();
    expect((await call(page, "me")).body).not.toContain(firstUser);
    await tab.close();
  });
}

test("expired refresh becomes logged out without a refresh loop", async ({ page, context }) => {
  await page.goto("/login");
  await context.clearCookies();
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/v1/auth/refresh")) calls.push(r.url());
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
  await expect.poll(() => calls.length).toBe(1);
  expect((await call(page, "me")).status).toBe(401);
});

test("일시적인 복원 오류는 보호 화면에서 로그인 리다이렉트를 일으키지 않는다", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("/write");
  await expect(page.getByText("로그인 상태를 확인하지 못했습니다.")).toBeVisible();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByRole("status")).toContainText("로그인 확인 중");
  await page.unroute("**/api/v1/me");
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
});
