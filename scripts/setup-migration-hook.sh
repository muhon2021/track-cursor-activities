#!/usr/bin/env bash
#
# Install a git pre-commit hook that runs migrations when any file under
# supabase/migrations/ is staged. Run once: ./scripts/setup-migration-hook.sh
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_PATH="$PROJECT_ROOT/.git/hooks/pre-commit"

if [ ! -d "$PROJECT_ROOT/.git" ]; then
  echo "Not a git repository. Skipping hook setup."
  exit 0
fi

mkdir -p "$(dirname "$HOOK_PATH")"

cat > "$HOOK_PATH" << 'HOOK'
#!/usr/bin/env bash
# Auto-generated: run migrations when supabase/migrations/ has staged changes

if git diff --cached --name-only --diff-filter=ACMR | grep -q '^supabase/migrations/.*\.sql$'; then
  echo "Staged migration files detected. Running migrations..."
  ./scripts/run-migrations.sh
  exit $?
fi
exit 0
HOOK

chmod +x "$HOOK_PATH"
echo "Pre-commit hook installed at .git/hooks/pre-commit"
echo "Migrations will run automatically when you commit changes to supabase/migrations/*.sql"
