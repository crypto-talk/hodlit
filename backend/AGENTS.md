# Backend conventions

These instructions apply to the entire `backend/` tree.

## Scope

- Never create, edit, delete, regenerate, commit, or push files under `frontend/**` during backend work. This includes UI components, page routes, styles, assets, generated API clients, tests, dependencies, configuration, and `frontend/AGENTS.md`.
- Record required frontend integration and visual changes in Jira for the frontend owner. Keep implementation changes within the backend and its required API documentation or deployment configuration.

## Architecture

- Organize code by feature package under `com.cryptalk` (`auth`, `post`, `social`, and similar).
- Keep controllers focused on HTTP mapping, validation, authentication principal extraction, and response status.
- Put business rules and authorization checks in services. Mark write operations `@Transactional` and read operations `@Transactional(readOnly = true)`.
- Use Spring Data JPA repositories for persistence. Avoid native SQL unless the domain query cannot be expressed clearly otherwise.
- Use request/response records for API DTOs. Put Jakarta validation constraints on request fields.
- Return expected client/domain failures through `ApiException`; keep the common `{message, timestamp}` error shape.

## Security and data

- All mutation endpoints require authentication unless a requirement explicitly says otherwise.
- When adding a public endpoint, add the narrowest method/path matcher to `SecurityConfig`; do not broaden unrelated routes.
- Derive the acting member from the validated JWT subject. Never accept an actor/member ID from the request body for authorization.
- Validate uploaded content, external URLs, lengths, numeric ranges, and enum values at the API boundary.
- Do not log tokens, cookies, passwords, wallet signatures, secrets, or full private user data.

## Database changes

- Hibernate uses `ddl-auto: validate`; Liquibase owns schema creation and evolution.
- Never rewrite an applied changelog. Add the next numbered formatted SQL file and include it in `db.changelog-master.yaml`.
- Add foreign keys, uniqueness, useful indexes, and deletion behavior deliberately.
- Keep MySQL production behavior and H2 `MODE=MySQL` test compatibility in mind.

## API and tests

- Preserve `/api/v1` URL versioning and existing JSON field names unless the issue explicitly calls for a breaking change.
- Update the relevant file in `docs/` and Swagger-visible DTO/controller metadata when an external contract changes.
- Add a regression test for every bug fix and an integration test for each new endpoint or authorization rule.
- Prefer `MockMvc` tests for HTTP contracts. Cover success, validation failure, missing authentication, forbidden ownership, and not-found behavior as applicable.
- Run `./gradlew test`; the Docker build is the production-equivalent fallback because it also runs tests and builds the boot jar.

Follow adjacent code style and avoid broad formatting changes. New code should favor readable declarations over copying compressed legacy formatting.
