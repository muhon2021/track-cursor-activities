#!/usr/bin/env bash
#
# Mark all local migration files as "applied" on the remote without running them.
# Use when the remote DB already has the schema (e.g. after repair) and you want
# to sync history so future "npm run migrations:run" only runs new migrations.
#
# Use: npm run migrations:mark-applied
# Prereq: npx supabase login, supabase link
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/supabase/migrations"
SUPABASE_CMD="npx supabase"

cd "$PROJECT_ROOT"

if ! $SUPABASE_CMD projects list &> /dev/null; then
  echo "Supabase CLI is not logged in. Run: npx supabase login"
  exit 1
fi

# Get version from each migration file: <timestamp>_name.sql -> version is the timestamp (first segment)
versions=()
for f in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$f" ] || continue
  basename=$(basename "$f" .sql)
  # Skip if doesn't look like timestamp_name (timestamp = digits only at start)
  if [[ $basename =~ ^([0-9]+)_ ]]; then
    version="${BASH_REMATCH[1]}"
    versions+=("$version")
  fi
done

# Sort (Supabase may expect order)
IFS=$'\n' sorted=($(sort -u <<<"${versions[*]}"))
unset IFS

if [ ${#sorted[@]} -eq 0 ]; then
  echo "No migration files found in supabase/migrations/"
  exit 0
fi

echo "Marking ${#sorted[@]} local migration(s) as applied on remote..."
$SUPABASE_CMD migration repair --status applied "${sorted[@]}"
echo "Done. Run 'npm run migrations:run' to apply only new migrations in the future."
