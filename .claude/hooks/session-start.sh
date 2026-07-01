#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install npm dependencies
# Uses `npm install` (not `npm ci`) to take advantage of container caching
# Uses `--ignore-scripts` to avoid postinstall failures from packages that
# download external binaries (e.g. supabase CLI), which aren't needed for
# linting or building
cd "$CLAUDE_PROJECT_DIR"
npm install --ignore-scripts

# Verify every Edge Function directory has a matching config.toml entry
FUNCTIONS_DIR="$CLAUDE_PROJECT_DIR/supabase/functions"
CONFIG_FILE="$CLAUDE_PROJECT_DIR/supabase/config.toml"
MISSING_COUNT=0

if [ -d "$FUNCTIONS_DIR" ] && [ -f "$CONFIG_FILE" ]; then
  for func_dir in "$FUNCTIONS_DIR"/*/; do
    func_name=$(basename "$func_dir")
    [ "$func_name" = "_shared" ] && continue
    if ! grep -q "\[functions\.$func_name\]" "$CONFIG_FILE" 2>/dev/null; then
      echo "WARNING: Edge Function '$func_name' is missing from config.toml (will 401 in production)"
      MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
  done
  if [ "$MISSING_COUNT" -gt 0 ]; then
    echo "ALERT: $MISSING_COUNT Edge Function(s) missing from config.toml. Add entries before deploying."
  fi
fi
