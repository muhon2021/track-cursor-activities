#!/usr/bin/env bash
#
# sync-config-functions.sh
# Automatically adds missing edge functions from supabase/functions/ to supabase/config.toml
#
# Run this script:
#   - Manually: ./scripts/sync-config-functions.sh
#   - After creating a new edge function
#   - Via git hook (see scripts/setup-config-sync-hook.sh)
#
# Usage:
#   ./scripts/sync-config-functions.sh           # Sync and update config.toml
#   ./scripts/sync-config-functions.sh --dry-run # Show what would be added without writing
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Paths (run from project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"
CONFIG_FILE="$PROJECT_ROOT/supabase/config.toml"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

cd "$PROJECT_ROOT"

# Validate paths
if [[ ! -d "$FUNCTIONS_DIR" ]]; then
  echo -e "${RED}❌ Error: supabase/functions/ not found${NC}"
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo -e "${RED}❌ Error: supabase/config.toml not found${NC}"
  exit 1
fi

# Discover functions from filesystem (directories in supabase/functions, exclude _shared)
DISCOVERED_FUNCTIONS=()
for dir in "$FUNCTIONS_DIR"/*/; do
  dirname=$(basename "$dir")
  if [[ "$dirname" != "_shared" ]] && [[ -f "${dir}index.ts" ]]; then
    DISCOVERED_FUNCTIONS+=("$dirname")
  fi
done

# Extract functions already in config.toml
CONFIGURED_FUNCTIONS=()
while IFS= read -r line; do
  if [[ "$line" =~ ^\[functions\.([a-zA-Z0-9_-]+)\] ]]; then
    CONFIGURED_FUNCTIONS+=("${BASH_REMATCH[1]}")
  fi
done < "$CONFIG_FILE"

# Find missing functions
MISSING_FUNCTIONS=()
for fn in "${DISCOVERED_FUNCTIONS[@]}"; do
  found=false
  for cfg in "${CONFIGURED_FUNCTIONS[@]}"; do
    if [[ "$fn" == "$cfg" ]]; then
      found=true
      break
    fi
  done
  if [[ "$found" == false ]]; then
    MISSING_FUNCTIONS+=("$fn")
  fi
done

# Report
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Edge Functions Config Sync${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Discovered: ${#DISCOVERED_FUNCTIONS[@]} functions in supabase/functions/"
echo -e "Configured: ${#CONFIGURED_FUNCTIONS[@]} functions in config.toml"
echo ""

if [[ ${#MISSING_FUNCTIONS[@]} -eq 0 ]]; then
  echo -e "${GREEN}✅ All edge functions are already in config.toml${NC}"
  echo ""
  exit 0
fi

echo -e "${YELLOW}Missing functions (${#MISSING_FUNCTIONS[@]}):${NC}"
for fn in "${MISSING_FUNCTIONS[@]}"; do
  echo "  - $fn"
done
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo -e "${YELLOW}Dry run - no changes made. Run without --dry-run to update config.toml${NC}"
  echo ""
  exit 0
fi

# Default: verify_jwt = false (common for webhooks, OAuth, background triggers)
# Set VERIFY_JWT_DEFAULT=true in env to require JWT by default for new functions
DEFAULT_VERIFY_JWT="${VERIFY_JWT_DEFAULT:-false}"

# Append missing functions to config.toml
{
  echo ""
  echo "# Auto-added functions - run scripts/sync-config-functions.sh to sync"
  for fn in "${MISSING_FUNCTIONS[@]}"; do
    echo "[functions.$fn]"
    echo "verify_jwt = $DEFAULT_VERIFY_JWT"
    echo ""
  done
} >> "$CONFIG_FILE"

echo -e "${GREEN}✅ Added ${#MISSING_FUNCTIONS[@]} function(s) to config.toml${NC}"
echo ""
echo "Default: verify_jwt = $DEFAULT_VERIFY_JWT"
echo "To require JWT by default for new functions: VERIFY_JWT_DEFAULT=true ./scripts/sync-config-functions.sh"
echo ""
