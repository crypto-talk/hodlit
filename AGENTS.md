# CrypTalk agent harness

## Repository map

- `backend/`: Java 24, Spring Boot 3.5, Gradle, JPA, Liquibase, MySQL API.
- `frontend/`: React/Next.js source. It is not deployed by this Umbrel backend pipeline.
- `docs/`: human-readable API and handoff documentation.
- `.github/workflows/deploy-backend.yml`: deploys backend-related changes pushed to `develop`.
- `deploy-backend.sh`: production deployment entry point for the self-hosted runner.

## Working rules

- Treat `develop` as the integration and backend deployment branch.
- Use the project-local `$feature` skill for backend feature implementation that must be committed and pushed.
- The `$feature` skill works on `feature/...` branches based on `origin/develop`; never implement feature work directly on `develop`.
- Do not merge a feature branch into `develop` unless the user explicitly asks.
- Preserve unrelated user changes. Never stash, reset, or delete them to make a task easier.
- Never commit `.env`, credentials, refresh tokens, private keys, database data, or uploaded media.
- Keep frontend changes out of backend tasks unless the user explicitly expands the scope.
- Prefer `rg` and `rg --files` for repository discovery.

## Sources of truth

- Runtime and dependency versions: `backend/build.gradle` and `backend/Dockerfile`.
- Database schema history: `backend/src/main/resources/db/changelog/`.
- Authentication behavior: `docs/AUTH_API.md` and the current auth source.
- Social API behavior: `docs/SOCIAL_API.md` and the current controller/DTO source.
- Deployment behavior: `.github/workflows/deploy-backend.yml` and `deploy-backend.sh`.

## Verification

- Backend unit/integration tests: `cd backend && ./gradlew test`.
- Container-equivalent verification: `docker build --file backend/Dockerfile backend`.
- Static hygiene: `git diff --check` and review `git diff --stat` plus `git diff`.
- A push to `feature/**` runs the non-deploying backend feature check.
- A push to `develop` that touches backend deployment paths builds, tests, deploys, and health-checks production.

Read `backend/AGENTS.md` before changing anything under `backend/`.
Read `frontend/AGENTS.md` before changing anything under `frontend/`.
