# Hodlit frontend agent harness

Read the repository `AGENTS.md` first. This file adds the rules that apply under `frontend/`.

The product is **Hodlit**. The repository, the npm package name, the API domain and the Java
package are still spelled `cryptalk`; renaming those is a separate job scheduled for just
before launch. Anything a user can see — page titles, OG tags, visible copy — says Hodlit.
The `sessionStorage` key `cryptalk_access` is left alone; it disappears when `access` moves
to a cookie (B-3).

## Stack

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4.
- UI primitives: shadcn/ui (copied into `components/ui/`, styled with our tokens). Icons: `lucide-react`.
- Server state: TanStack Query. Client global state: session, modal, toast only.
- Editor: Tiptap (rich text, markdown paste, custom chart node). Charts: `lightweight-charts`.
- Tests: Vitest for unit tests (`pnpm test`), Playwright for e2e. `tests/rendered-html.test.mjs`
  is a separate build-dependent check run by `pnpm run test:html`.
- Fonts: Pretendard, self-hosted. Static subset woff2 in `styles/fonts/`, loaded by `app/fonts.ts`.
- pnpm is the package manager, pinned by `packageManager` in `package.json`. Never run
  `npm install` here; it would create a competing `package-lock.json`.
- Deployed on Vercel. `next build` is the build; there is no Cloudflare Worker runtime.
- The API client talks to the Spring Boot backend at `NEXT_PUBLIC_API_URL`. There is no
  database, ORM or server-side data layer in this project.

## Where the other documents are

- Notion "구조 고민하기" — the structure decisions A~G with their reasoning, the settled
  folder tree, and the open questions for the backend. This is the source of truth for
  *why* something is the way it is.
  https://app.notion.com/p/3dc64d6951428066a501d5da4a774997
- Claude project `claude/프로젝트_컨텍스트.md` — current state, branch status, repository
  conventions and their rationale, open issues, session setup.

This file carries the rules an agent has to follow. When it disagrees with the Notion tree,
the Notion tree wins and this file gets fixed.

## Repository map (settled 2026-09-18)

```
app/
  layout.tsx            root: font + <Providers>. Server component.
  providers.tsx         "use client": QueryClientProvider (toast provider goes here too)
  fonts.ts              next/font/local; files in styles/fonts/
  globals.css           imports styles/tokens.css + Tailwind @theme mapping only
  not-found.tsx         single 404
  (shell)/              header + sidebar (>=900px) / bottom tab (<900px)
    page.tsx            landing (server component, Promise.all over sections)
    subhodl/[symbol]/page.tsx             room board
    subhodl/[symbol]/[postId]/page.tsx    post detail
    [handle]/page.tsx   public profile; notFound() unless handle starts with "@"
  (focus)/              header only
    login/  signup/  write/  settings/  settings/wallet/
    subhodl/[symbol]/[postId]/edit/
features/               one folder per domain: auth wallet room post comment vote badge landing
  <domain>/components/  hooks/  api.ts  types.ts  mock.ts  (schema.ts optional)
                        unit tests sit next to the source as `*.test.ts`
components/ui/          shadcn primitives (+ *.stories.tsx)
components/layout/      header sidebar footer fab (+ types.ts: the shape the shell receives)
                        bottom-tab is still to come
lib/http.ts             fetch wrapper: baseURL, credentials, bearer token, single-flight 401
                        refresh, {code,message} normalisation. Every backend request goes
                        through it
lib/auth-token.ts       the only place the access token is read or written; deleted at B-3
lib/api-schema.ts       generated from the backend OpenAPI spec by `pnpm gen:api`. Never
                        hand-edited, excluded from ESLint and Prettier
lib/query.ts  lib/format/  lib/utils.ts (cn)  lib/config.ts (env, single read point)
styles/tokens.css       semantic CSS variables; [data-theme="dark"] block left empty
styles/fonts/           Pretendard subset woff2, 400/600/700/800/900
components.json         shadcn/ui config; `shadcn add` writes into components/ui/
vitest.config.ts        unit test scope: features/**/*.test.ts, lib/**/*.test.ts
tests/e2e/              Playwright: login.spec.ts, publish-post.spec.ts (run locally)
.storybook/             Storybook config; stories only for components/ui and features/badge
```

`app/_components/*` and `lib/mock/landing.ts` are gone: step 2 moved the shell into
`components/layout/`, the landing sections into `features/landing/components/`, the room list
into `features/room/`, the auth form into `features/auth/components/`, and the landing
stylesheet to `styles/hd.css` (imported once by `app/layout.tsx`). `lib/api.ts` is the last
pre-restructure file. It now calls `lib/http.ts` instead of holding its own token and retry
logic, but it is still scheduled to disappear. (`lib/AuthApi.ts` was a second, unused copy of
the same auth calls and a second token store; it was deleted when `lib/auth-token.ts` landed.)

`lib/session.tsx` holds the logged-in member. It is in `lib/`, not `features/auth/`, because
`components/layout/header.tsx` needs it and `components/` cannot import `features/`. It also
exports `useRequireLogin()`, which sends a logged-out visitor to `/login?next=<here>` and
returns whether it redirected.

## Structure rules

1. Imports flow one way: `app/ -> features/ -> components/ | lib/`. `features/*` never import
   each other. Shared code moves down to `components/` or `lib/`. Enforced by ESLint.
   ⚠️ One known conflict: rule 3 says badge wording is made only in `features/badge/`, which
   every other feature needs. `features/landing/api.ts` imports it with an explicit
   `eslint-disable` and a reason, because duplicating the wording is the more dangerous of the
   two options. This is a signal that `features/badge/` belongs in `lib/` or `components/` —
   unresolved, ask before adding a second such import.
2. `features/<domain>/api.ts` is the only data entry point. Mock data lives in `mock.ts` and
   never leaks past `api.ts`. Components receive data through props only.
3. Badge and holder-snapshot wording exists only in `features/badge/label.ts`. These are the
   wallet de-anonymisation guard, so they must not be reimplemented per screen.
   **The amount band is computed by the backend**, not here: `holderSnapshot.quantityBand`
   arrives as a finished string (`"10~100 ETH"`, or null when unverified) and is passed
   through. Recomputing it from a raw quantity puts the boundaries in two places, and they
   drifted apart once already. To change the bands, change `PostHolderSnapshot.band()` in the
   backend. `holdingMonths` likewise arrives already floored; do not round it again.
4. One component per file. No barrel `index.ts` files; use the `@/` alias instead.
5. File and folder names are kebab-case (`post-card.tsx`). Components and types are PascalCase.
   Hooks are `use-*.ts`. Windows git is case-insensitive and the Vercel build is not.
6. `"use client"` goes on the interactive leaf (button, tab, editor, vote widget), not on a
   whole section or page. The root layout stays a server component; context providers live
   in `app/providers.tsx` and are rendered from it.
7. Design tokens are defined once in `styles/tokens.css` with semantic names
   (`--color-text-primary`, not `--purple`). Components use Tailwind classes that reference
   them. Runtime values such as a room's `accentColor` are injected as inline CSS variables.
8. Tab, filter and sort state of any list lives in the URL query string.
9. Loading/error boundaries: `loading.tsx` per route segment, `error.tsx` per route group,
   inline retry inside a failed section. Toasts and modals are for action failures only.

## Restructure state

Step 1 (foundation, no screens) is done: tokens, self-hosted Pretendard, `components/ui/`
primitives, `features/badge/` with unit tests, `lib/` (config, format, query, http skeleton,
utils), route group boundaries with `error.tsx`, the root `not-found.tsx`, and the ESLint
import-direction rule.

Deliberately not done yet, do not treat these as oversights:

- `features/landing/mock.ts` still holds the three sections the backend has no API for at
  all: the marquee aggregate, trending rooms (G-3) and the daily vote (G-5). They reach the
  screen through `features/landing/api.ts` (`marqueeItems()`, `trendingRooms()`,
  `dailyVotes()`) so that structure rule 2 holds and only those functions change when the
  APIs land. Rooms come from `features/room/api.ts`; the feed and hot posts from
  `features/landing/api.ts`.
- `app/globals.css` still carries the pre-restructure landing rules below the `@theme` block.
  Those ~96 classes are dead: nothing uses them, because every screen renders with the `hd-*`
  classes from `styles/hd.css`. The block is deleted in step 2 ②; it needs no untangling.
- `lib/http.ts` carries the bearer token and refreshes once on 401, but it still does not
  forward cookies from a server component: that waits for `access` to move to a cookie (B-3).
  Until then server components fetch public data only. It also does not branch on the error
  `code`, because the code list is not agreed yet (C-5) — branch on `ApiError.status`.
- `components/ui/` is exempt from ESLint so the shadcn copies stay diffable against upstream.
- Storybook. It goes in now that `components/ui/` and `features/badge/` exist.
- husky, lint-staged and GitHub Actions. They live at the repository root, outside
  `frontend/`, so they need an explicit scope expansion and belong in their own change.

### Step 2 — landing, login, deploy

The boundary of step 2 is **a deployed site**, not a finished UI. One screen and a real login
go up first.

1. ✅ The landing is `app/(shell)/page.tsx`. `app/_components/landing/*` split into
   `features/landing/components/` and `components/layout/` (header, sidebar, footer, fab).
   The shell is rendered by `app/(shell)/layout.tsx`, which also owns the room list and the
   connected wallets — every screen in step 3 gets them for free. The bottom tab (<900px)
   is not built yet; the fab covers that width for now.
2. ⬜ Convert `styles/hd.css` to tokens and Tailwind classes, and delete the dead block in
   `app/globals.css`. Everything still renders with the `hd-*` classes.
3. ✅ `AuthDialog` is now `/login?next=` and `/signup` (A-5). `?next=` is read on the server
   and passed down, so no `<Suspense>` boundary is needed, and `features/auth/safe-next.ts`
   rejects anything that is not a same-site path — an unchecked `next` is an open redirect.
4. ✅ Deployed to Vercel. `CORS_ALLOWED_ORIGINS` (not `PUBLIC_ORIGIN` — the old name in these
   documents was wrong) includes the domain, and `AUTH_COOKIE_SECURE=true`.
5. ✅ `tests/rendered-html.test.mjs` now checks the landing, both auth pages, and that a
   hostile `?next=` never becomes an href.

C-1 (who owns the API types) is settled: the backend's OpenAPI spec generates them.

Known rough edges left by step 2, deliberately:

- `app/(shell)/layout.tsx` is a client component. `access` is still in sessionStorage, so the
  server cannot know who is logged in (B-3), and connecting a wallet calls a browser
  extension. When `access` moves to a cookie, the room list can be fetched on the server and
  only the interactive part stays a client component.
- The 글쓰기 buttons in the header and the fab are disabled with a title, like the search box.
  The write screen is step 3; a button that goes nowhere is worse than one that says so.
- The marquee is rendered by the shell layout, not the landing, because it is a strip across
  the whole screen group. Its three numbers are still mock (no aggregate API).

### Step 3 — the remaining four screens

Room board, post detail, profile and settings, then the editor. E-2 (the post body format)
should be settled before the editor is built; it is the most expensive screen and the one
that gets thrown away if the format flips.

Mock data is fine for layout, but keep G-5's rule: where the backend has no number, show
"준비 중" or a fixed label rather than a plausible fake. A screen full of invented numbers
becomes the spec.

## Working rules

- Base new work on the latest `origin/develop` and work on a `<type>/<what>` branch. `<type>` is
  the Conventional Commit type the change mostly is — `feat/`, `fix/`, `refactor/`, `docs/`,
  `test/`, `chore/`; `<what>` is a few kebab-case words naming the area, not a ticket number
  (`refactor/screen-structure`, `feat/post-editor`). Mixed work takes the type of its largest part.
  ⚠️ This is a `frontend/` rule. The repository root still says `feature/...`, and two things
  actually depend on it: the `Backend feature check` workflow only runs on `feature/**`, and the
  `create-pr` skill refuses a head branch that does not start with `feature/`. Neither is a
  frontend file — do not change them from a frontend task. Open frontend PRs yourself rather
  than through `create-pr`.
- Keep backend changes out of frontend tasks unless the user explicitly expands the scope.
- Preserve unrelated user changes. Never stash, reset, or delete them to make a task easier.
- Never commit `.env*` files, tokens, or API credentials.
- Use Conventional Commit subjects: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Write the Korean subject as a **noun phrase**, not a sentence: `refactor: 타이포 스케일 토큰화`,
  not `refactor: 타이포 스케일을 토큰으로 올린다`. The body is ordinary prose and ends in `~다`.
  The subject names what changed; the body says why.
- **Do not add AI attribution to commits or pull requests.** No `Co-Authored-By:` for an
  assistant, no session links, no "generated with" footers. The commit author is the person
  who ran the task. This applies to every agent working in this repository.

## Never minify or collapse source

Write one statement per line. Do not collapse a component, a rule set, or a JSX subtree
onto a single line to save space. (The legacy block at the bottom of `app/globals.css` still
packs ~22 KB onto a handful of lines. It is dead code and gets deleted in step 2 ②, so do not
spend effort reformatting it.)

## Contract with the backend

- `features/*/types.ts` mirror the backend DTOs field for field. When an endpoint's response
  changes, update the type in the same commit as the code that reads it.
- Runtime response validation (zod) only for money/PII responses: `/me/assets`, snapshots,
  wallet. Everything else trusts the type.
- `GET /api/v1/me/assets` returns `AssetPortfolio` (`{ walletCount, assets }`), not an array.
- Posts and comments carry `holderSnapshot` (`HolderSnapshotResponse`): `verificationLevel`
  is `WALLET` or `UNVERIFIED` (no exchange tier exists yet), `quantityBand` is a finished
  string or null, `holdingMonths` is an already-floored integer or null.
- OpenAPI spec: https://cryptalk-api.hojun.xyz/v3/api-docs — the accurate endpoint list.
  `pnpm gen:api` writes it to `lib/api-schema.ts`; run it after any backend change and commit
  the result. `GET /feed` (cursor + size, returns `{items, nextCursor, hasMore}`) already
  exists; the older documents claiming there is no global feed are out of date.
- **Every field of every response type is optional in `lib/api-schema.ts`.** The backend does
  not emit `required` on response schemas, so springdoc marks all of them `?`. Request bodies
  are correct. Until the backend fixes this, a feature that needs a non-optional field
  narrows it in its own `types.ts` and says why — do not spread `?` through the components.
- `holdingMonths` is always `null` until an EVM indexer populates `holdingSince`. Render the
  fixed label `보유 기간 미확인`; do not build UI that assumes a value.
- Public post and comment responses do not carry wallet addresses. Do not reintroduce them.
- `POST /posts` ignores a client-supplied `assetPrice`; the server captures the price itself.
- Auth uses `loginId`, not email: `{ loginId, password }` to log in, plus `nickname` to sign
  up. `refresh` is an httpOnly cookie today; `access` is in sessionStorage and is being moved
  to an httpOnly cookie (backend task). Until then, server components cannot render
  logged-in state.
- `lib/api-schema.ts` is the accurate list of endpoints. Do not copy it into a document; the
  copy goes stale and someone writes against it.
- Open backend requests are listed in the Notion page "구조 고민하기" → "백엔드와 논의할 항목".

## Fonts

Pretendard is self-hosted through `next/font/local` (subset woff2). Do not load fonts from
Google Fonts or a CDN `<link>`; the CDN link currently in `app/page.tsx` is removed in the
restructure.

## Verification

Run from `frontend/`, in order:

1. `pnpm exec tsc --noEmit`
2. `pnpm run lint`
3. `pnpm test` — Vitest unit suite, no build needed
4. `pnpm run build`
5. `pnpm run test:html` — rendered-HTML check; it builds again, so run it after step 4 only
   when the change can affect the rendered page

CI runs steps 1-3. Do not put `test:html` in CI as well; it would make the build run twice.

Playwright e2e tests need the backend running; they are run locally, not in CI, for now.
