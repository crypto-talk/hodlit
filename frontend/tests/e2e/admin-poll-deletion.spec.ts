import { expect, test, type Page } from "@playwright/test";

async function apiFixture(page: Page) {
  const makePoll = (id: number, active: boolean, coinSymbol = "ETH") => ({
    id,
    coinSymbol,
    active,
    question: active ? "지금 투표 질문" : "지난 투표 질문",
    totalVotes: 98765,
    userChoiceId: 11,
    choices: [
      { id: 11, label: "상승", voteCount: 98765 },
      { id: 12, label: "하락", voteCount: 0 },
    ],
  });
  const polls = new Map([
    [1, makePoll(1, true)],
    [42, makePoll(42, false)],
    [43, makePoll(43, false, "BTC")],
  ]);
  const state = {
    deleteCalls: 0,
    closeCalls: 0,
    createCalls: 0,
    deleteStatus: 204,
    expired: false,
    hold: null as Promise<void> | null,
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();
    const send = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        headers: {
          "Access-Control-Allow-Origin": "http://127.0.0.1:13000",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        },
        ...(status === 204 ? {} : { json: value }),
      });
    if (method === "OPTIONS") return send(undefined, 204);
    if (path === "/auth/refresh" || (path === "/me" && state.expired)) {
      return send({ message: "로그인이 필요합니다." }, 401);
    }
    if (path === "/me") {
      return send({
        id: 7,
        nickname: "테스트관리자",
        avatarColor: "#abcdef",
        role: "ADMIN",
        assetVisibility: "HIDDEN",
        walletAddress: null,
      });
    }
    if (path === "/admin/communities")
      return send({
        items: ["ETH", "BTC"].map((symbol, i) => ({
          id: i + 1,
          symbol,
          name: symbol,
          active: true,
          operationStatus: "OPEN",
        })),
        page: 0,
        totalPages: 1,
        totalElements: 2,
      });
    if (path === "/communities/ETH/poll") {
      const current = [...polls.values()].find((poll) => poll.coinSymbol === "ETH" && poll.active);
      return current ? send(current) : send({ message: "현재 투표가 없습니다." }, 404);
    }
    if (path === "/communities/ETH/polls" && method === "POST") {
      state.createCalls++;
      for (const poll of polls.values()) poll.active = false;
      const body = request.postDataJSON();
      const next = { ...makePoll(44, true), question: body.question };
      polls.set(next.id, next);
      return send(next, 201);
    }
    const match = /^\/polls\/(\d+)(\/close)?$/.exec(path);
    if (match) {
      const id = Number(match[1]);
      if (method === "DELETE") {
        state.deleteCalls++;
        if (state.hold) await state.hold;
        if (state.deleteStatus === 204 || state.deleteStatus === 404) polls.delete(id);
        if (state.deleteStatus === 401) state.expired = true;
        return send({ message: "서버 점검 중입니다." }, state.deleteStatus);
      }
      const poll = polls.get(id);
      if (!poll) return send({ message: "투표를 찾을 수 없습니다." }, 404);
      if (match[2]) {
        state.closeCalls++;
        poll.active = false;
        return send(undefined, 204);
      }
      return send(poll);
    }
    return send([]);
  });
  return state;
}

test("확인·취소, 처리 중 중복 방지와 204 후 현재 투표 갱신", async ({ page }) => {
  const state = await apiFixture(page);
  await page.goto("/admin/polls?room=ETH");
  await page.getByRole("button", { name: "이 투표 삭제", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("지금 투표 질문");
  await expect(dialog).toContainText("ETH · 투표 #1");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  expect(state.deleteCalls).toBe(0);
  await page.getByRole("button", { name: "이 투표 삭제", exact: true }).click();
  let release!: () => void;
  state.hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await dialog
    .getByRole("button", { name: "삭제", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(dialog.getByRole("button", { name: "삭제하는 중…" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "취소", exact: true })).toBeDisabled();
  await expect.poll(() => state.deleteCalls).toBe(1);
  release();
  await expect(page.getByText("투표를 삭제했습니다.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("열린 투표가 없습니다. 사용자 화면의 투표 칸은 비어 있습니다."),
  ).toBeVisible();
  expect(state.deleteCalls).toBe(1);
});

test("종료된 투표 번호 조회·새로고침·삭제, 모바일에서 대상 확인", async ({ page }) => {
  const state = await apiFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/polls?room=ETH");
  await page.getByLabel("투표 번호", { exact: true }).fill("42");
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page).toHaveURL(/room=ETH&poll=42/);
  await page.reload();
  await expect(page.getByText("ETH · 투표 #42 · 종료됨")).toBeVisible();
  await expect(page.getByText("98765")).toHaveCount(0);
  await page.getByRole("button", { name: "조회한 투표 삭제" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("지난 투표 질문");
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("투표를 삭제했습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "조회한 투표 삭제" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "이 투표 삭제", exact: true })).toBeVisible();
  expect(state.deleteCalls).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("기존 종료 확인 후 종료된 투표를 다시 선택하고 새 투표 생성", async ({ page }) => {
  const state = await apiFixture(page);
  await page.goto("/admin/polls?room=ETH");
  await page.getByRole("button", { name: "이 투표 닫기" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "취소", exact: true }).click();
  expect(state.closeCalls).toBe(0);
  await page.getByRole("button", { name: "이 투표 닫기" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page).toHaveURL(/poll=1/);
  await expect(page.getByText("ETH · 투표 #1 · 종료됨")).toBeVisible();
  expect(state.closeCalls).toBe(1);
  await page.getByLabel("질문", { exact: true }).fill("새 투표 질문");
  await page.getByLabel("1번 선택지", { exact: true }).fill("상승");
  await page.getByLabel("2번 선택지", { exact: true }).fill("하락");
  await page.getByRole("button", { name: "투표 만들기", exact: true }).click();
  await expect(page.getByText("새 투표를 열었습니다.", { exact: true })).toBeVisible();
  await expect(page.getByText("새 투표 질문", { exact: true })).toBeVisible();
  expect(state.createCalls).toBe(1);
});

test("삭제 중 세션이 만료되면 로그인 화면으로 이동한다", async ({ page }) => {
  const state = await apiFixture(page);
  state.deleteStatus = 401;
  await page.goto("/admin/polls?room=ETH");
  await page.getByRole("button", { name: "이 투표 삭제", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByText("투표를 삭제했습니다.", { exact: true })).toHaveCount(0);
  expect(state.deleteCalls).toBe(1);
});

for (const [status, message] of [
  [403, "관리자 권한"],
  [404, "이미 삭제"],
  [500, "서버 점검 중입니다."],
] as const) {
  test(`${status} 삭제 오류는 성공으로 안내하지 않고 재조회한다`, async ({ page }) => {
    const state = await apiFixture(page);
    state.deleteStatus = status;
    await page.goto("/admin/polls?room=ETH");
    await page.getByRole("button", { name: "이 투표 삭제", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByText(message, { exact: false }).first()).toBeVisible();
    await expect(page.getByText("투표를 삭제했습니다.", { exact: true })).toHaveCount(0);
    if (status === 404)
      await expect(page.getByRole("button", { name: "이 투표 삭제", exact: true })).toHaveCount(0);
    if (status === 403 || status === 500)
      await expect(page.getByRole("button", { name: "이 투표 삭제", exact: true })).toBeEnabled();
  });
}

test("다른 방의 투표는 선택한 방에서 삭제하지 않는다", async ({ page }) => {
  await apiFixture(page);
  await page.goto("/admin/polls?room=ETH&poll=43");
  await expect(page.getByText("선택한 방의 투표가 아닙니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "조회한 투표 삭제" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "해당 방에서 확인" })).toHaveAttribute(
    "href",
    "/admin/polls?room=BTC&poll=43",
  );
});
