#!/bin/bash
# Apply Agentic AI Migrations and Regenerate Types
# This script applies the new Tool Orchestration and Agent Memory System migrations

set -e  # Exit on error

echo "=================================================="
echo "Applying Agentic AI Migrations"
echo "=================================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found"
    echo "Install it with: npm install -g supabase"
    exit 1
fi

echo "✓ Supabase CLI found"
echo ""

# Check if .env or supabase config exists
if [ ! -f "supabase/config.toml" ]; then
    echo "⚠️  Warning: supabase/config.toml not found"
    echo "Make sure you're in the project root directory"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "=================================================="
echo "Step 1: Applying Database Migrations"
echo "=================================================="
echo ""

# List migrations to be applied
echo "The following migrations will be applied:"
echo "  1. 20260205_mcp_servers_and_tools.sql"
echo "  2. 20260205_agent_multi_step_execution.sql"
echo "  3. 20260205_agent_memory_system.sql"
echo ""

# Ask for confirmation
read -p "Apply migrations? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Apply migrations
echo ""
echo "Applying migrations..."
supabase db push

if [ $? -eq 0 ]; then
    echo "✓ Migrations applied successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""
echo "=================================================="
echo "Step 2: Regenerating TypeScript Types"
echo "=================================================="
echo ""

# Check if we're using local or remote
read -p "Using local Supabase? (y for local, n for remote) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Local
    echo "Generating types from local database..."
    supabase gen types typescript --local > src/integrations/supabase/types.ts
else
    # Remote
    echo "Enter your Supabase Project ID (or press Enter to skip):"
    read -r PROJECT_ID

    if [ -z "$PROJECT_ID" ]; then
        echo "⚠️  Skipping type generation (no project ID provided)"
    else
        echo "Generating types from remote database..."
        supabase gen types typescript --project-id "$PROJECT_ID" > src/integrations/supabase/types.ts
    fi
fi

if [ -f "src/integrations/supabase/types.ts" ]; then
    echo "✓ Types regenerated successfully"
else
    echo "⚠️  Types file not found - you may need to generate manually"
fi

echo ""
echo "=================================================="
echo "Step 3: Removing Type Assertions"
echo "=================================================="
echo ""

# Remove 'as never' type assertions from hooks
echo "Removing temporary type assertions from hooks..."

if [ -f "src/hooks/useAgentTools.ts" ]; then
    # This is a simple approach - in production you'd want more sophisticated replacement
    sed -i.bak 's/ as never//g' src/hooks/useAgentTools.ts
    rm -f src/hooks/useAgentTools.ts.bak
    echo "✓ Updated useAgentTools.ts"
fi

if [ -f "src/hooks/useAgentMemory.ts" ]; then
    sed -i.bak 's/ as never//g' src/hooks/useAgentMemory.ts
    rm -f src/hooks/useAgentMemory.ts.bak
    echo "✓ Updated useAgentMemory.ts"
fi

echo ""
echo "=================================================="
echo "Step 4: Verification"
echo "=================================================="
echo ""

echo "Checking database tables..."
supabase db diff --use-migra 2>&1 | head -20

echo ""
echo "=================================================="
echo "✅ Migration Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "  1. Review the generated types in src/integrations/supabase/types.ts"
echo "  2. Run 'npm run build' to verify everything compiles"
echo "  3. Test the new features:"
echo "     - Tool orchestration (execute-mcp-tool edge function)"
echo "     - Agent memory (retrieve-agent-memories edge function)"
echo ""
echo "New tables created:"
echo "  • mcp_servers - MCP server configurations"
echo "  • mcp_tools - Tool definitions"
echo "  • mcp_tool_executions - Execution history"
echo "  • agent_execution_plans - Multi-step workflows"
echo "  • agent_execution_steps - Individual workflow steps"
echo "  • agent_reasoning_traces - Agent reasoning capture"
echo "  • agent_memories - Memory storage with embeddings"
echo "  • user_preferences - Learned preferences"
echo "  • agent_learning_events - Feedback tracking"
echo ""
