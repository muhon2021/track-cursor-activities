#!/bin/bash

# CollabAI Framework - Deployment Verification Script
# This script verifies that all components are properly deployed

echo "🔍 CollabAI Framework - Deployment Verification"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUPABASE_URL="https://tjkqvbxtziheggurtvcz.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqa3F2Ynh0emloZWdndXJ0dmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzk4MzUsImV4cCI6MjA4MjcxNTgzNX0.cpxkZ-0bKYfCPUOO6UszMiEoxXPn1d_3xR6_S4QXgQM"

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test edge function
test_function() {
  local func_name=$1
  local endpoint="${SUPABASE_URL}/functions/v1/${func_name}"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  echo -n "Testing ${func_name}... "

  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${endpoint}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d '{}' \
    --max-time 5 2>/dev/null)

  if [ "$response" = "200" ] || [ "$response" = "400" ] || [ "$response" = "201" ]; then
    echo -e "${GREEN}✓ OK${NC} (HTTP ${response})"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP ${response})"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

echo "1. Testing Edge Functions"
echo "-------------------------"

# Test critical functions
test_function "validate-api-key"
test_function "ai-chat-assistant"
test_function "semantic-search"
test_function "generate-embeddings"
test_function "send-notification"

echo ""
echo "2. Testing Database Connection"
echo "-------------------------------"

TOTAL_TESTS=$((TOTAL_TESTS + 1))
db_test=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/version" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  --max-time 5 2>/dev/null)

if [ -n "$db_test" ]; then
  echo -e "Database connection: ${GREEN}✓ OK${NC}"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "Database connection: ${RED}✗ FAIL${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "3. Testing Data Tables"
echo "----------------------"

# Test clients table
TOTAL_TESTS=$((TOTAL_TESTS + 1))
clients=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/clients?select=count" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  --max-time 5 2>/dev/null)

if echo "$clients" | grep -q "count"; then
  echo -e "Clients table: ${GREEN}✓ OK${NC}"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "Clients table: ${RED}✗ FAIL${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test meetings table
TOTAL_TESTS=$((TOTAL_TESTS + 1))
meetings=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/meetings?select=count" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  --max-time 5 2>/dev/null)

if echo "$meetings" | grep -q "count"; then
  echo -e "Meetings table: ${GREEN}✓ OK${NC}"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "Meetings table: ${RED}✗ FAIL${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test knowledge_entries table
TOTAL_TESTS=$((TOTAL_TESTS + 1))
knowledge=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/knowledge_entries?select=count" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  --max-time 5 2>/dev/null)

if echo "$knowledge" | grep -q "count"; then
  echo -e "Knowledge Base table: ${GREEN}✓ OK${NC}"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e "Knowledge Base table: ${RED}✗ FAIL${NC}"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "================================================"
echo "Verification Summary"
echo "================================================"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed! Deployment is successful.${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ Some tests failed. Please check the deployment.${NC}"
  echo ""
  echo "Troubleshooting:"
  echo "1. Verify edge functions are deployed in Supabase Dashboard"
  echo "2. Check environment variables are set correctly"
  echo "3. Ensure database migrations have been run"
  echo "4. Review function logs for specific errors"
  exit 1
fi
