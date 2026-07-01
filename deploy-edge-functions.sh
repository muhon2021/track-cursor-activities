#!/bin/bash

# CollabAI Framework - Edge Functions Deployment Script
# Deploys all 24 V1 edge functions to Supabase

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   CollabAI Framework - Edge Functions Deployment          ║"
echo "║   24 Functions Ready for Deployment                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if in correct directory
if [ ! -d "supabase/functions" ]; then
    echo -e "${RED}❌ Error: Must run from project root with supabase/functions/ directory${NC}"
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Error: Supabase CLI not installed${NC}"
    echo ""
    echo "Install options:"
    echo "  1. Via npm: npm install -g supabase"
    echo "  2. Via brew: brew install supabase/tap/supabase"
    echo "  3. Direct download: https://supabase.com/docs/guides/cli"
    echo ""
    exit 1
fi

echo -e "${BLUE}📋 Checking Supabase project link...${NC}"

# Check if linked to project
if [ ! -f ".git/config" ] && [ ! -f "supabase/.temp/project-ref" ]; then
    echo -e "${YELLOW}⚠️  Warning: Project may not be linked to Supabase${NC}"
    echo ""
    echo "To link your project, run:"
    echo "  supabase link --project-ref tjkqvbxtziheggurtvcz"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "Select deployment option:"
echo "  1) Deploy all 24 functions (recommended)"
echo "  2) Deploy by module (select which modules)"
echo "  3) Deploy specific function"
echo "  4) List existing deployments"
echo ""
read -p "Choice (1-4): " CHOICE

case $CHOICE in
    1)
        echo ""
        echo -e "${GREEN}🚀 Deploying all 24 edge functions...${NC}"
        echo ""

        # Foundation (4 functions)
        echo -e "${BLUE}📦 Foundation Functions (4)${NC}"
        supabase functions deploy validate-api-key --no-verify-jwt
        supabase functions deploy audit-log-writer --no-verify-jwt
        supabase functions deploy send-email --no-verify-jwt
        supabase functions deploy send-notification --no-verify-jwt
        echo ""

        # AI Functions (6 functions)
        echo -e "${BLUE}🤖 AI Functions (6)${NC}"
        supabase functions deploy ai-chat-assistant --no-verify-jwt
        supabase functions deploy semantic-search --no-verify-jwt
        supabase functions deploy run-ai-agent --no-verify-jwt
        supabase functions deploy generate-embeddings --no-verify-jwt
        supabase functions deploy generate-meeting-summary --no-verify-jwt
        supabase functions deploy generate-business-doc --no-verify-jwt
        echo ""

        # Meetings (5 functions)
        echo -e "${BLUE}📅 Meeting Functions (5)${NC}"
        supabase functions deploy sync-zoom-files --no-verify-jwt
        supabase functions deploy zoom-transcript-processing --no-verify-jwt
        supabase functions deploy auto-embed-meetings --no-verify-jwt
        supabase functions deploy categorize-meeting --no-verify-jwt
        supabase functions deploy api-v1-meetings --no-verify-jwt
        echo ""

        # Knowledge Base (7 functions)
        echo -e "${BLUE}📚 Knowledge Base Functions (7)${NC}"
        supabase functions deploy google-drive-sync --no-verify-jwt
        supabase functions deploy google-drive-upload --no-verify-jwt
        supabase functions deploy user-knowledge-upload --no-verify-jwt
        supabase functions deploy user-knowledge-drive-sync --no-verify-jwt
        supabase functions deploy user-knowledge-process --no-verify-jwt
        supabase functions deploy auto-embed-knowledge-files --no-verify-jwt
        supabase functions deploy unified-knowledge-search --no-verify-jwt
        echo ""

        # Clients (1 function)
        echo -e "${BLUE}👥 Client Functions (1)${NC}"
        supabase functions deploy api-v1-clients --no-verify-jwt
        echo ""

        # Feedback (1 function)
        echo -e "${BLUE}💬 Feedback Functions (1)${NC}"
        supabase functions deploy send-feedback-notification --no-verify-jwt
        echo ""

        echo -e "${GREEN}✅ All 24 functions deployed successfully!${NC}"
        ;;

    2)
        echo ""
        echo "Select modules to deploy (space-separated, e.g., '1 3 5'):"
        echo "  1) Foundation (4 functions)"
        echo "  2) AI (6 functions)"
        echo "  3) Meetings (5 functions)"
        echo "  4) Knowledge Base (7 functions)"
        echo "  5) Clients (1 function)"
        echo "  6) Feedback (1 function)"
        echo ""
        read -p "Modules: " MODULES

        for MODULE in $MODULES; do
            case $MODULE in
                1)
                    echo -e "${GREEN}Deploying Foundation...${NC}"
                    supabase functions deploy validate-api-key --no-verify-jwt
                    supabase functions deploy audit-log-writer --no-verify-jwt
                    supabase functions deploy send-email --no-verify-jwt
                    supabase functions deploy send-notification --no-verify-jwt
                    ;;
                2)
                    echo -e "${GREEN}Deploying AI Functions...${NC}"
                    supabase functions deploy ai-chat-assistant --no-verify-jwt
                    supabase functions deploy semantic-search --no-verify-jwt
                    supabase functions deploy run-ai-agent --no-verify-jwt
                    supabase functions deploy generate-embeddings --no-verify-jwt
                    supabase functions deploy generate-meeting-summary --no-verify-jwt
                    supabase functions deploy generate-business-doc --no-verify-jwt
                    ;;
                3)
                    echo -e "${GREEN}Deploying Meetings...${NC}"
                    supabase functions deploy sync-zoom-files --no-verify-jwt
                    supabase functions deploy zoom-transcript-processing --no-verify-jwt
                    supabase functions deploy auto-embed-meetings --no-verify-jwt
                    supabase functions deploy categorize-meeting --no-verify-jwt
                    supabase functions deploy api-v1-meetings --no-verify-jwt
                    ;;
                4)
                    echo -e "${GREEN}Deploying Knowledge Base...${NC}"
                    supabase functions deploy google-drive-sync --no-verify-jwt
                    supabase functions deploy google-drive-upload --no-verify-jwt
                    supabase functions deploy user-knowledge-upload --no-verify-jwt
                    supabase functions deploy user-knowledge-drive-sync --no-verify-jwt
                    supabase functions deploy user-knowledge-process --no-verify-jwt
                    supabase functions deploy auto-embed-knowledge-files --no-verify-jwt
                    supabase functions deploy unified-knowledge-search --no-verify-jwt
                    ;;
                5)
                    echo -e "${GREEN}Deploying Clients...${NC}"
                    supabase functions deploy api-v1-clients --no-verify-jwt
                    ;;
                6)
                    echo -e "${GREEN}Deploying Feedback...${NC}"
                    supabase functions deploy send-feedback-notification --no-verify-jwt
                    ;;
            esac
        done
        echo -e "${GREEN}✅ Selected modules deployed!${NC}"
        ;;

    3)
        echo ""
        read -p "Enter function name: " FUNC_NAME
        echo -e "${GREEN}Deploying $FUNC_NAME...${NC}"
        supabase functions deploy "$FUNC_NAME" --no-verify-jwt
        echo -e "${GREEN}✅ Function deployed!${NC}"
        ;;

    4)
        echo ""
        echo -e "${BLUE}📋 Listing deployed functions...${NC}"
        supabase functions list
        exit 0
        ;;

    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Verify deployment:"
echo "   supabase functions list"
echo ""
echo "2. Set environment variables (if not already done):"
echo "   supabase secrets set OPENAI_API_KEY=sk-..."
echo "   supabase secrets set ZOOM_CLIENT_ID=..."
echo "   supabase secrets set ZOOM_CLIENT_SECRET=..."
echo "   (see .env.example for all variables)"
echo ""
echo "3. Test functions:"
echo "   ./verify-deployment.sh"
echo ""
echo "4. Deploy database migrations:"
echo "   Run SQL files in supabase/migrations/ via Supabase Dashboard SQL Editor"
echo ""
