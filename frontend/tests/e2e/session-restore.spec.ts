import { expect, test, type Page } from "@playwright/test";

const member = {
  id: 1,
  nickname: "복원테스트",
  avatarColor: "#123456",
  walletAddress: null,
  assetVisibility: "PRIVATE",
};

async function fixture(page: Page) {
  const state = { refreshes: 0, unavailable: false, delay: false };
  await page.route("http://localhost:8798/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const headers: Record<string, string> = {
      "access-control-allow-origin": "http://localhost:3110",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/api/v1/me") {
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, 800));
      const status = state.unavailable
        ? 503
        : request.headers().authorization === "Bearer valid"
          ? 200
          : 401;
      return route.fulfill({ status, headers, json: status === 200 ? member : {} });
    }
    if (path === "/api/v1/auth/login") {
      headers["set-cookie"] = "cryptalk_refresh=valid; Path=/; HttpOnly; SameSite=Lax";
      return route.fulfill({ headers, json: { member, accessToken: "valid" } });
    }
    if (path === "/api/v1/auth/refresh") {
      state.refreshes += 1;
      const valid = request.headers().cookie?.includes("cryptalk_refresh=valid");
      return route.fulfill({
        status: valid ? 200 : 401,
        headers,
        json: valid ? { member, accessToken: "valid" } : {},
      });
    }
    if (path === "/api/v1/auth/logout") {
      headers["set-cookie"] = "cryptalk_refresh=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax";
      return route.fulfill({ status: 200, headers, body: "" });
    }
    return route.fulfill({
      headers,
      json: path.endsWith("/feed") ? { items: [], nextCursor: null, hasMore: false } : [],
    });
  });
  return state;
}

async function login(page: Page) {
  await page.goto("/login?next=/");
  await page.getByLabel("아이디", { exact: true }).fill("reload-user");
  await page.getByLabel("비밀번호", { exact: true }).fill("password-123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("link", { name: member.nickname, exact: true })).toBeVisible();
}

test("로그인 후 홈·보호 화면 새로고침은 refresh 없이 저장된 access로 복원", async ({
  page,
  context,
}) => {
  const state = await fixture(page);
  await login(page);
  await context.clearCookies(); // refresh가 없어도 유효한 access를 사용해야 한다.
  const before = state.refreshes;
  await page.reload();
  await expect(page.getByRole("link", { name: member.nickname, exact: true })).toBeVisible();
  await page.goto("/write");
  await page.reload();
  await expect(page.getByRole("link", { name: member.nickname, exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/write$/);
  expect(state.refreshes).toBe(before);
});

test("만료된 access는 refresh 쿠키로 한 번 갱신한 뒤 보호 화면 복원", async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  const before = state.refreshes;
  await page.evaluate(() => sessionStorage.setItem("cryptalk_access", "expired"));
  await page.goto("/write");
  await expect(page.getByRole("link", { name: member.nickname, exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/write$/);
  expect(state.refreshes).toBe(before + 1);
});

test("느린 복원 중에는 헤더 로그인 표시·보호 화면 이동 보류", async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  state.delay = true;
  await page.goto("/write");
  await expect(page.getByRole("status")).toHaveText("로그인 확인 중…");
  await expect(page.getByRole("link", { name: "로그인", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByRole("link", { name: member.nickname, exact: true })).toBeVisible();
});

test("일시적인 복원 장애는 로그아웃하지 않고 재시도로 복구", async ({ page }) => {
  const state = await fixture(page);
  await login(page);
  state.unavailable = true;
  await page.goto("/write");
  await expect(
    page.getByRole("alert").filter({ hasText: "로그인 상태를 확인하지 못했습니다." }),
  ).toContainText("로그인 상태를 확인하지 못했습니다.");
  await expect(page).toHaveURL(/\/write$/);
  expect(await page.evaluate(() => sessionStorage.getItem("cryptalk_access"))).toBe("valid");
  state.unavailable = false;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByRole("link", { name: member.nickname, exact: true })).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "로그인 상태를 확인하지 못했습니다." }),
  ).toHaveCount(0);
});

test("실제 세션 만료는 로그인으로 이동하고 토큰 제거", async ({ page, context }) => {
  await fixture(page);
  await login(page);
  await context.clearCookies();
  await page.evaluate(() => sessionStorage.setItem("cryptalk_access", "expired"));
  await page.goto("/write");
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(await page.evaluate(() => sessionStorage.getItem("cryptalk_access"))).toBeNull();
});

test("명시적 로그아웃 후 새로고침해도 세션 복원 없음", async ({ page }) => {
  await fixture(page);
  await login(page);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByRole("link", { name: "로그인", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "로그인", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: member.nickname, exact: true })).toHaveCount(0);
});
