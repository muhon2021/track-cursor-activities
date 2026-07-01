#!/usr/bin/env bash
#
# create-edge-function.sh
# Creates a new Supabase edge function and adds it to config.toml
#
# Usage:
#   ./scripts/create-edge-function.sh my-new-function
#   ./scripts/create-edge-function.sh api-v2-users --verify-jwt
#
# Options:
#   --verify-jwt    Add with verify_jwt = true (default: false)
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"

# Parse args
FUNC_NAME=""
VERIFY_JWT="false"
for arg in "$@"; do
  if [[ "$arg" == "--verify-jwt" ]]; then
    VERIFY_JWT="true"
  elif [[ -z "$FUNC_NAME" ]] && [[ "$arg" != --* ]]; then
    FUNC_NAME="$arg"
  fi
done

if [[ -z "$FUNC_NAME" ]]; then
  echo -e "${RED}Usage: $0 <function-name> [--verify-jwt]${NC}"
  echo ""
  echo "Examples:"
  echo "  $0 my-webhook           # Creates function, verify_jwt = false"
  echo "  $0 api-v2-users --verify-jwt   # Creates function, verify_jwt = true"
  exit 1
fi

# Validate function name (alphanumeric, hyphens, underscores)
if [[ ! "$FUNC_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo -e "${RED}❌ Invalid function name. Use only letters, numbers, hyphens, and underscores.${NC}"
  exit 1
fi

FUNC_DIR="$FUNCTIONS_DIR/$FUNC_NAME"
if [[ -d "$FUNC_DIR" ]]; then
  echo -e "${RED}❌ Function '$FUNC_NAME' already exists at $FUNC_DIR${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}Creating edge function: $FUNC_NAME${NC}"
echo ""

# Create function directory and index.ts
mkdir -p "$FUNC_DIR"
cat > "$FUNC_DIR/index.ts" << 'FUNC_EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // TODO: Implement your edge function logic
    return new Response(
      JSON.stringify({
        success: true,
        message: "Edge function is ready",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
FUNC_EOF

# Replace placeholder in the template - the template is generic, no replacement needed
echo -e "${GREEN}✅ Created $FUNC_DIR/index.ts${NC}"

# Add this function to config.toml (sync will skip it since it's now configured)
CONFIG_FILE="$PROJECT_ROOT/supabase/config.toml"
{
  echo ""
  echo "# $FUNC_NAME - created by create-edge-function.sh"
  echo "[functions.$FUNC_NAME]"
  echo "verify_jwt = $VERIFY_JWT"
  echo ""
} >> "$CONFIG_FILE"
echo -e "${GREEN}✅ Added to config.toml (verify_jwt = $VERIFY_JWT)${NC}"

# Run sync to add any other missing functions
"$SCRIPT_DIR/sync-config-functions.sh"

echo ""
echo -e "${GREEN}✅ Edge function '$FUNC_NAME' created and added to config.toml${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit supabase/functions/$FUNC_NAME/index.ts"
echo "  2. Deploy: supabase functions deploy $FUNC_NAME"
echo ""
