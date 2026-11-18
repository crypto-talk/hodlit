/**
 * `pnpm dev:mock` — 가짜 API 서버와 `next dev` 를 같이 띄운다.
 *
 * `NEXT_PUBLIC_API_URL` 을 가짜 서버로 바꿔서 넘기므로 `.env.local` 은 건드리지 않는다.
 * 둘 중 하나가 끝나면 나머지도 끈다. Windows 에서도 돌도록 셸을 거쳐 실행한다.
 */
import { spawn } from "node:child_process";

const PORT = process.env.MOCK_PORT ?? "8787";
const env = { ...process.env, MOCK_PORT: PORT, NEXT_PUBLIC_API_URL: `http://localhost:${PORT}` };

const children = [
  spawn("node", ["mock/server.mjs"], { env, stdio: "inherit", shell: true }),
  spawn("pnpm", ["exec", "next", "dev"], { env, stdio: "inherit", shell: true }),
];

const stop = () => {
  for (const child of children) child.kill();
};
for (const child of children) {
  child.on("exit", (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
