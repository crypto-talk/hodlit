#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/source" "$TEST_DIR/bin"
git init --initial-branch=develop "$TEST_DIR/source" >/dev/null
git -C "$TEST_DIR/source" config user.email test@example.com
git -C "$TEST_DIR/source" config user.name Test
printf '#!/usr/bin/env bash\nexit 99\n' > "$TEST_DIR/source/deploy-backend.sh"
chmod +x "$TEST_DIR/source/deploy-backend.sh"
git -C "$TEST_DIR/source" add .
git -C "$TEST_DIR/source" commit -m old-deployment >/dev/null
git -C "$TEST_DIR/source" switch -c main >/dev/null
cp "$ROOT/deploy-backend.sh" "$TEST_DIR/source/deploy-backend.sh"
git -C "$TEST_DIR/source" add .
git -C "$TEST_DIR/source" commit -m main-deployment >/dev/null
target="$(git -C "$TEST_DIR/source" rev-parse HEAD)"
git clone --single-branch --branch develop "$TEST_DIR/source" "$TEST_DIR/app" >/dev/null 2>&1
printf 'MYSQL_PASSWORD=test-only\n' > "$TEST_DIR/app/.env"
printf '.env\n' >> "$TEST_DIR/app/.git/info/exclude"
cat > "$TEST_DIR/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [[ "$1" == inspect ]]; then
  echo healthy
elif [[ "$1" == compose && "$4" == ps && "${5:-}" == -q ]]; then
  echo test-backend-container
fi
MOCK
chmod +x "$TEST_DIR/bin/docker"

# Simulate Actions executing a fresh script against an old develop-only checkout.
PATH="$TEST_DIR/bin:$PATH" CRYPTALK_APP_DIRECTORY="$TEST_DIR/app" \
  CRYPTALK_EXPECTED_COMMIT="$target" bash "$ROOT/deploy-backend.sh"
[[ "$(git -C "$TEST_DIR/app" branch --show-current)" == main ]]
[[ "$(git -C "$TEST_DIR/app" rev-parse HEAD)" == "$target" ]]
[[ "$(git -C "$TEST_DIR/app" rev-parse origin/main)" == "$target" ]]
echo 'PASS: old develop-only checkout deploys the expected main commit'

# An unrelated commit must still be rejected before deployment.
git -C "$TEST_DIR/source" switch --orphan unrelated >/dev/null 2>&1
git -C "$TEST_DIR/source" commit --allow-empty -m unrelated >/dev/null
unrelated="$(git -C "$TEST_DIR/source" rev-parse HEAD)"
git -C "$TEST_DIR/app" fetch origin "$unrelated" >/dev/null 2>&1
set +e
PATH="$TEST_DIR/bin:$PATH" CRYPTALK_APP_DIRECTORY="$TEST_DIR/app" \
  CRYPTALK_EXPECTED_COMMIT="$unrelated" bash "$ROOT/deploy-backend.sh"
result=$?
set -e
[[ "$result" == 6 ]]
echo 'PASS: commit outside main is rejected'
