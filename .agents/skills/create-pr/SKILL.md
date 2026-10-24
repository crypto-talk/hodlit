---
name: create-pr
description: Verify, summarize, and open a GitHub pull request for a CrypTalk feature branch with GitHub CLI. Use when the user asks to create, open, submit, or prepare a PR, write its title and body, or turn a pushed feature branch into a PR against develop.
---

# Create a pull request

Open one reviewed, evidence-backed PR without merging it. Treat an explicit invocation as authorization to create the PR, but not to merge, deploy, or modify unrelated GitHub state.

## 1. Establish the PR scope

1. Read the repository `AGENTS.md` files that govern the changed paths.
2. Confirm the head branch starts with `feature/`. Use `develop` as the base unless the user explicitly names another base.
3. Check `git status --short --branch`. Never stash, reset, clean, or discard unrelated changes.
4. Fetch the head and base refs from `origin` and verify the intended local commit is pushed.
5. If unpushed commits remain, state the exact remote and request any approval required by the environment before pushing.

## 2. Review before publishing

Inspect all commits and changes relative to the base:

```bash
git log --oneline origin/develop..HEAD
git diff --check origin/develop...HEAD
git diff --stat origin/develop...HEAD
git diff origin/develop...HEAD
```

Confirm that the diff contains no credentials, generated data, accidental frontend changes, or unrelated files. Do not create the PR if the branch is empty or its scope is unclear.

Check for an existing PR with `gh pr list --head <branch> --state all`. If an open PR exists, do not create a duplicate; read it back and report its URL. If only a closed or merged PR exists for the same head, ask before reopening or creating another.

## 3. Verify checks

Use the latest workflow run whose head SHA matches the branch tip. Wait for an in-progress feature check when practical. Never describe an unrun check as passing.

- If CI passes, record the workflow name and URL.
- If CI fails, inspect its logs and stop before creating a ready-for-review PR unless the user explicitly wants a draft.
- If no workflow applies, report the local checks that actually ran and explain why CI is absent.

## 4. Write the title and body

Use a concise title that describes the user-visible outcome. Include a Jira key when the branch or commits contain one.

Write a self-contained body with only relevant sections:

```markdown
## 요약
- 왜 이 변경이 필요한지와 최종 동작

## 주요 변경
- 핵심 코드, API, 데이터 변경

## 검증
- 실제 실행한 테스트와 CI 결과

## 참고
- 마이그레이션, 호환성, 후속 작업 또는 알려진 제한
```

Omit an empty section. Do not claim tests, compatibility, or deployment results without evidence. Put the body in a task-specific temporary file so shell quoting cannot corrupt Markdown.

## 5. Create and read back

Create the PR with explicit refs:

```bash
gh pr create --base develop --head <feature-branch> --title <title> --body-file <body-file>
```

Use `--draft` only when the user requests a draft or explicitly accepts incomplete checks. After creation, run `gh pr view` and verify the number, URL, base, head, title, and state. Do not merge, enable auto-merge, assign reviewers, or add labels unless the user asks.

## 6. Handoff

Report the PR link, number, base and head branches, title, test/CI result, and any migration or follow-up note. Clearly state that the PR was not merged.
