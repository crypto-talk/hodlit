import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = 3100 + (process.pid % 400);
const origin = `http://127.0.0.1:${port}`;

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(origin, { headers: { accept: "text/html" } });
      if (response.status < 500) return;
    } catch {
      // Server is not accepting connections yet.
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`next start did not become ready on ${origin}`);
}

test("server-renders the Hodlit application", async (t) => {
  const server = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "start", "--port", String(port)],
    { cwd: projectRoot, stdio: "ignore", env: { ...process.env, PORT: String(port) } },
  );
  t.after(() => server.kill("SIGTERM"));

  await waitForServer();

  await t.test("랜딩", async () => {
    const response = await fetch(origin, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200);

    const html = await response.text();
    // 아래 문구는 app/(shell)/layout.tsx 와 app/(shell)/page.tsx 의 마크업 기준이다.
    assert.match(html, /Hodlit/);
    assert.match(html, /지금 뜨는 방/);
    assert.match(html, /이더리움/);
    assert.doesNotMatch(html, /Your site is taking shape/);

    // 셸이 레이아웃으로 올라갔다. 사이드바와 푸터가 랜딩에도 그대로 있어야 한다.
    assert.match(html, /지갑 연결/);
    assert.match(html, /투자 권유가 아니며/);

    // 로그인은 모달이 아니라 /login 페이지다. 헤더의 버튼이 링크여야 한다.
    assert.match(html, /href="\/login\?next=[^"]*"/);
    assert.match(html, /href="\/signup"/);

    // 폰트는 셀프호스팅이다(D-5). CDN 링크가 다시 들어오면 여기서 걸린다.
    assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  });

  await t.test("로그인 페이지", async () => {
    const response = await fetch(`${origin}/login?next=%2F`, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.match(html, /아이디/);
    assert.match(html, /비밀번호/);
    assert.match(html, /계정 만들기/);
    // (focus) 화면군에는 사이드바가 없다.
    assert.doesNotMatch(html, /전체 방/);
  });

  await t.test("회원가입 페이지", async () => {
    const response = await fetch(`${origin}/signup`, { headers: { accept: "text/html" } });
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.match(html, /닉네임/);
    assert.match(html, /이미 계정이 있어요/);
  });

  await t.test("글쓰기 페이지", async () => {
    const response = await fetch(`${origin}/write?symbol=eth`, {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.match(html, /제목/);
    // 본문 에디터(Tiptap)는 클라이언트에서만 그려진다. 서버 HTML 에는 글자 수 칸만 있다.
    assert.match(html, /5,000/);
    assert.match(html, /발행/);
    // 헤더의 글쓰기가 더 이상 비활성 버튼이 아니라 링크다.
    assert.match(html, /href="\/write"/);
    // (focus) 화면군에는 사이드바가 없다.
    assert.doesNotMatch(html, /전체 방/);
  });

  await t.test("오픈 리다이렉트 방어", async () => {
    // `?next=` 가 외부 주소면 폼은 홈으로 돌아가야 한다(features/auth/safe-next.ts).
    const response = await fetch(`${origin}/login?next=https%3A%2F%2Fevil.example`, {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 200);

    const html = await response.text();
    // 원본 문자열은 Next 의 라우터 상태(RSC 페이로드)에 그대로 남는다. 중요한
    // 것은 그게 링크가 되지 않는 것이라, href 만 본다.
    assert.doesNotMatch(html, /href="[^"]*evil\.example/);
    assert.match(html, /href="\/signup\?next=%2F"/);
  });
});
