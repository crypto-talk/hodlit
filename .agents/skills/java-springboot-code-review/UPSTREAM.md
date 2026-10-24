# Upstream provenance

- Source: https://github.com/kumarprabhashanand/java-springboot-code-review
- Pinned commit: `bd11923971283c569b64a183117b6e76cb93d77a`
- License: MIT (see `LICENSE`)
- Imported files: `SKILL.md`, `references/spring-pitfalls.md`, `references/business-impact-patterns.md`, `LICENSE`.

## Local adaptations

- Added CrypTalk scope, project-instruction precedence, read-only review, evidence requirements, Korean output, and verification rules.
- Corrected the example's unsupported inference that missing service-level `@Transactional` necessarily causes inconsistent persistence.
- Qualified interface/non-public transaction annotations, wildcard CORS, scheduling overlap, and cached write-method behavior to reduce false positives.

The bundled references are review prompts, not authoritative framework documentation. Validate technical claims against the project's versions and configuration before reporting findings.
