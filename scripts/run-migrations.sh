#!/usr/bin/env bash
#
# Run Supabase migrations and report success or failure.
# Use:  npm run migrations:run   (not npx run)
# Or:  ./scripts/run-migrations.sh
#
# To run automatically when you commit new migrations, install the hook:
#   ./scripts/setup-migration-hook.sh
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Running Supabase migrations..."
echo ""

# Use npx so the project's devDependency (supabase) is used; no global install needed
SUPABASE_CMD="npx supabase"
if ! $SUPABASE_CMD --version &> /dev/null; then
  echo -e "${RED}Error: Supabase CLI not found.${NC}"
  echo "Install the project dependency: npm install"
  echo "Or install globally: https://supabase.com/docs/guides/cli"
  exit 1
fi

# Run migrations (pushes to linked remote project). --yes avoids interactive prompt.
output=$($SUPABASE_CMD db push --yes 2>&1)
exit_code=$?

if [ $exit_code -eq 0 ]; then
  echo -e "${GREEN}✓ Migrations applied successfully.${NC}"
  echo ""
  echo "$output"
  exit 0
else
  echo -e "${RED}✗ Migration failed.${NC}"
  echo ""
  echo "$output"
  echo ""
  echo -e "${YELLOW}Troubleshooting:${NC}"
  if echo "$output" | grep -q "Remote migration versions not found in local"; then
    echo "  • Remote history doesn't match local. Run: npm run migrations:repair"
  fi
  if echo "$output" | grep -q "already exists"; then
    echo "  • Schema already on remote. To sync history without re-running migrations: npm run migrations:mark-applied"
  fi
  echo "  • Ensure the project is linked: npx supabase link"
  echo "  • Check migration SQL for syntax errors"
  echo "  • Run locally first: npx supabase start && npx supabase db reset"
  exit $exit_code
fi
