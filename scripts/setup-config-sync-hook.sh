#!/usr/bin/env bash
#
# Install a git pre-commit hook that syncs config.toml when new edge functions
# are added to supabase/functions/. Run once: ./scripts/setup-config-sync-hook.sh
#
# The hook runs scripts/sync-config-functions.sh when any function folder
# (excluding _shared) has staged changes.
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_PATH="$PROJECT_ROOT/.git/hooks/pre-commit"

if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "Not a git repository. Skipping hook setup."
  exit 0
fi

mkdir -p "$(dirname "$HOOK_PATH")"

# Config sync hook block (inserted before final exit 0)
SYNC_HOOK_BLOCK='
# Sync config.toml when new edge functions are added
if git diff --cached --name-only --diff-filter=ACMR | grep "^supabase/functions/" | grep -v "^supabase/functions/_shared/" | grep -q .; then
  echo "Edge function changes detected. Syncing config.toml..."
  ./scripts/sync-config-functions.sh
  git add supabase/config.toml 2>/dev/null || true
fi
'

# Check if pre-commit already exists
if [ -f "$HOOK_PATH" ]; then
  if grep -q "sync-config-functions" "$HOOK_PATH"; then
    echo "Config sync hook already installed."
    exit 0
  fi
  # Insert our block before the final exit 0 (sed '$d' removes last line, portable)
  sed '$d' "$HOOK_PATH" > "$HOOK_PATH.tmp"
  echo "$SYNC_HOOK_BLOCK" >> "$HOOK_PATH.tmp"
  echo "exit 0" >> "$HOOK_PATH.tmp"
  mv "$HOOK_PATH.tmp" "$HOOK_PATH"
else
  cat > "$HOOK_PATH" << 'HOOK'
#!/usr/bin/env bash
# Sync config.toml when new edge functions are added

if git diff --cached --name-only --diff-filter=ACMR | grep "^supabase/functions/" | grep -v "^supabase/functions/_shared/" | grep -q .; then
  echo "Edge function changes detected. Syncing config.toml..."
  ./scripts/sync-config-functions.sh
  git add supabase/config.toml 2>/dev/null || true
fi
exit 0
HOOK
  chmod +x "$HOOK_PATH"
fi

echo "Config sync hook installed/updated at .git/hooks/pre-commit"
echo "config.toml will be auto-synced when you add or modify edge functions."
