#!/usr/bin/env sh
# Build and run the support walkthrough without contacting external services.
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SERVICE_DIR="$REPO_ROOT/service"

if [ ! -x "$SERVICE_DIR/node_modules/.bin/tsc" ]; then
  echo "Demo dependencies are not installed. Run 'npm --prefix service ci' once, then retry offline." >&2
  exit 2
fi

SUPPORT_CONFIG="$REPO_ROOT/demo/no-config.json" \
STORE_DRIVER=memory \
LLM_DRIVER=mock \
npm --prefix "$SERVICE_DIR" run --silent build

SUPPORT_CONFIG="$REPO_ROOT/demo/no-config.json" \
STORE_DRIVER=memory \
LLM_DRIVER=mock \
node "$SERVICE_DIR/dist/src/demo.js" \
  "$REPO_ROOT/demo/sample_data" \
  "$REPO_ROOT/demo/sample_messages.json"
