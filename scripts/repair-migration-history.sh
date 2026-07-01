#!/usr/bin/env bash
#
# One-time fix when remote has migration versions that don't exist locally
# (e.g. "Remote migration versions not found in local migrations directory").
# Marks those remote versions as reverted so local migrations can be pushed.
#
# Use: npm run migrations:repair
# Prereq: npx supabase login   (and supabase link if not already linked)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

SUPABASE_CMD="npx supabase"

# Check login (repair and db push need access token)
if ! $SUPABASE_CMD projects list &> /dev/null; then
  echo "Supabase CLI is not logged in. Run: npx supabase login"
  exit 1
fi

# Versions that were reported as "not found in local" (from your error output).
# Run repair to mark them reverted on the remote, then db push can run local migrations.
VERSIONS="20251231002139 20251231002153 20251231002946 20251231172608 20251231173308 20251231202731 20251231214711 20251231214948 20260102154954 20260102161849 20260102162553 20260102165228 20260102181808 20260110191302 20260110192342 20260110192413 20260110200244 20260110200618 20260114113756 20260119194315 20260120152957 20260201235631 20260202164129 20260202173535"

echo "Repairing remote migration history (marking versions as reverted)..."
$SUPABASE_CMD migration repair --status reverted $VERSIONS

echo ""
echo "Running migrations..."
bash "$SCRIPT_DIR/run-migrations.sh"
