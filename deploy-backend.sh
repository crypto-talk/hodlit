#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIRECTORY="${CRYPTALK_APP_DIRECTORY:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)}"
DEPLOY_BRANCH="${CRYPTALK_BRANCH:-main}"
EXPECTED_COMMIT="${CRYPTALK_EXPECTED_COMMIT:-}"
HEALTH_TIMEOUT_SECONDS="${CRYPTALK_HEALTH_TIMEOUT_SECONDS:-180}"

if [[ ! -d "$APP_DIRECTORY/.git" ]]; then
  echo "Git checkout not found: $APP_DIRECTORY" >&2
  exit 1
fi

if [[ ! -f "$APP_DIRECTORY/.env" ]]; then
  echo "Missing $APP_DIRECTORY/.env. Copy .env.example and set its secrets first." >&2
  exit 2
fi

if [[ -n "$(git -C "$APP_DIRECTORY" status --porcelain)" ]]; then
  echo "Refusing to deploy because $APP_DIRECTORY has uncommitted changes." >&2
  exit 3
fi

if grep -q 'replace-with-' "$APP_DIRECTORY/.env"; then
  echo "Refusing to deploy with placeholder secrets in $APP_DIRECTORY/.env" >&2
  exit 4
fi

if ! docker info >/dev/null 2>&1; then
  echo "The runner user cannot access Docker. Add it to the docker group and restart the runner service." >&2
  exit 5
fi

echo "Fetching $DEPLOY_BRANCH in $APP_DIRECTORY"
previous_commit="$(git -C "$APP_DIRECTORY" rev-parse HEAD)"
git -C "$APP_DIRECTORY" fetch origin "refs/heads/$DEPLOY_BRANCH:refs/remotes/origin/$DEPLOY_BRANCH"
if git -C "$APP_DIRECTORY" show-ref --verify --quiet "refs/heads/$DEPLOY_BRANCH"; then
  git -C "$APP_DIRECTORY" switch "$DEPLOY_BRANCH"
else
  git -C "$APP_DIRECTORY" switch --no-track -c "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
fi

target_commit="${EXPECTED_COMMIT:-$(git -C "$APP_DIRECTORY" rev-parse "origin/$DEPLOY_BRANCH")}"
if ! git -C "$APP_DIRECTORY" merge-base --is-ancestor "$target_commit" "origin/$DEPLOY_BRANCH"; then
  echo "Refusing to deploy $target_commit because it is not on origin/$DEPLOY_BRANCH." >&2
  exit 6
fi

git -C "$APP_DIRECTORY" merge --ff-only "$target_commit"
current_commit="$(git -C "$APP_DIRECTORY" rev-parse HEAD)"

if [[ "$current_commit" != "$target_commit" ]]; then
  echo "Expected $target_commit, but the checkout is at $current_commit." >&2
  exit 7
fi

if [[ "$previous_commit" != "$current_commit" && "${CRYPTALK_BACKEND_DEPLOY_REEXEC:-}" != "$current_commit" ]]; then
  echo "Deployment files may have changed; restarting from $current_commit"
  CRYPTALK_BACKEND_DEPLOY_REEXEC="$current_commit" exec "$APP_DIRECTORY/deploy-backend.sh"
fi

COMPOSE=(docker compose --project-directory "$APP_DIRECTORY")

echo "Building and testing backend at $current_commit"
"${COMPOSE[@]}" build --pull backend

echo "Replacing only the backend container"
"${COMPOSE[@]}" up -d --no-deps --remove-orphans backend

deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  container_id="$("${COMPOSE[@]}" ps -q backend)"
  if [[ -n "$container_id" ]]; then
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{if .State.Running}}healthy{{else}}stopped{{end}}{{end}}' "$container_id")"
    if [[ "$health" == "healthy" ]]; then
      "${COMPOSE[@]}" ps backend
      echo "Backend deployment completed successfully at $current_commit."
      exit 0
    fi
    if [[ "$health" == "unhealthy" || "$health" == "stopped" ]]; then
      break
    fi
  fi
  sleep 5
done

echo "Backend did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s." >&2
"${COMPOSE[@]}" ps backend >&2
"${COMPOSE[@]}" logs --no-color --tail=150 backend >&2
exit 8
