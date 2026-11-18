#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIRECTORY="${CRYPTALK_APP_DIRECTORY:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)}"
DEPLOY_BRANCH="${CRYPTALK_BRANCH:-main}"
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

echo "Updating $DEPLOY_BRANCH in $APP_DIRECTORY"
previous_commit="$(git -C "$APP_DIRECTORY" rev-parse HEAD)"
git -C "$APP_DIRECTORY" fetch origin "$DEPLOY_BRANCH"
git -C "$APP_DIRECTORY" switch "$DEPLOY_BRANCH"
git -C "$APP_DIRECTORY" pull --ff-only origin "$DEPLOY_BRANCH"
current_commit="$(git -C "$APP_DIRECTORY" rev-parse HEAD)"

if [[ "$previous_commit" != "$current_commit" && "${CRYPTALK_DEPLOY_REEXEC:-}" != "$current_commit" ]]; then
  echo "Deployment script may have changed; restarting from $current_commit"
  CRYPTALK_DEPLOY_REEXEC="$current_commit" exec "$APP_DIRECTORY/deploy-server.sh"
fi

COMPOSE=(docker compose --project-directory "$APP_DIRECTORY")
SUDO_KEEPALIVE_PID=""

cleanup() {
  if [[ -n "$SUDO_KEEPALIVE_PID" ]]; then
    kill "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! docker info >/dev/null 2>&1; then
  echo "Docker requires sudo. Authenticate once to continue the deployment."
  sudo -v
  while true; do
    sudo -n true
    sleep 60
  done &
  SUDO_KEEPALIVE_PID=$!
  COMPOSE=(sudo docker compose --project-directory "$APP_DIRECTORY")
fi

"${COMPOSE[@]}" pull mysql
"${COMPOSE[@]}" build --pull backend
"${COMPOSE[@]}" up -d --remove-orphans

deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  unhealthy="$("${COMPOSE[@]}" ps --format json | grep -E '"Health":"(unhealthy|starting)"|"State":"(created|restarting|exited|dead)"' || true)"
  if [[ -z "$unhealthy" ]]; then
    "${COMPOSE[@]}" ps
    echo "CrypTalk deployment completed successfully."
    exit 0
  fi
  sleep 5
done

echo "Services did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s." >&2
"${COMPOSE[@]}" ps >&2
"${COMPOSE[@]}" logs --no-color --tail=100 backend mysql >&2
exit 5
