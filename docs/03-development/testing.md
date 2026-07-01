# 🧪 Testing Guide - CollabAI Framework

> **Comprehensive testing procedures for all framework features**

---

## 📋 Test Categories

1. [Database Tests](#database-tests)
2. [Authentication Tests](#authentication-tests)
3. [CRUD Operations Tests](#crud-operations-tests)
4. [AI Features Tests](#ai-features-tests)
5. [Edge Functions Tests](#edge-functions-tests)
6. [Integration Tests](#integration-tests)

---

## 💾 Database Tests

### Test 1: Verify All Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected:** 23+ tables including:
- clients
- meetings
- knowledge_entries
- ai_agents
- embeddings
- notifications

### Test 2: Verify Test Data

```sql
-- Check clients
SELECT COUNT(*) as client_count FROM clients;
-- Expected: 5 clients

-- Check knowledge entries
SELECT COUNT(*) as knowledge_count FROM knowledge_entries;
-- Expected: 3+ entries

-- Check AI agents
SELECT COUNT(*) as agent_count FROM ai_agents;
-- Expected: 3 agents

-- Check knowledge categories
SELECT * FROM knowledge_categories;
-- Expected: 5 categories
```

### Test 3: Verify Functions

```sql
-- Check match_embeddings function
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'match_embeddings';
-- Expected: 1 row

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Expected: 1 row
```

---

## 🔐 Authentication Tests

### Test 1: Email Signup

1. Go to `/signup`
2. Enter:
   - Email: test@example.com
   - Password: Test@123456
3. Submit form
4. **Expected:** Email verification sent, redirect to confirmation page

### Test 2: Google OAuth

1. Go to `/login`
2. Click "Continue with Google"
3. Authorize with Google account
4. **Expected:** Redirect to dashboard, user created in database

### Test 3: Login

1. Go to `/login`
2. Enter credentials
3. Submit
4. **Expected:** Redirect to dashboard, session established

### Test 4: Protected Routes

1. Logout
2. Try to access `/dashboard`
3. **Expected:** Redirect to `/login`

### Test 5: Admin Access

1. Login as regular user
2. Try to access `/admin`
3. **Expected:** Access denied or redirect

---

## 📝 CRUD Operations Tests

### Clients Module Tests

#### Test 1: Create Client

1. Navigate to `/clients`
2. Click "Add Client"
3. Fill form:
   - Name: Test Client
   - Email: client@test.com
   - Company: Test Corp
   - Phone: +1-555-1234
   - Notes: Test notes
4. Submit
5. **Expected:**
   - Success toast notification
   - Client appears in list
   - Database record created

**SQL Verification:**
```sql
SELECT * FROM clients WHERE email = 'client@test.com';
```

#### Test 2: Edit Client

1. Click edit on a client
2. Modify name to "Updated Client"
3. Submit
4. **Expected:**
   - Success notification
   - Name updated in list
   - Database updated

**SQL Verification:**
```sql
SELECT name FROM clients WHERE id = '[CLIENT_ID]';
```

#### Test 3: Delete Client

1. Click delete on a client
2. Confirm deletion
3. **Expected:**
   - Success notification
   - Client removed from list
   - Database record deleted

**SQL Verification:**
```sql
SELECT * FROM clients WHERE id = '[CLIENT_ID]';
-- Should return 0 rows
```

#### Test 4: Search Clients

1. Enter search term in search box
2. **Expected:** Filtered results displayed

#### Test 5: View Client Details

1. Click on a client name
2. **Expected:** Detail page shows all client info

### Meetings Module Tests

#### Test 1: Create Meeting

1. Navigate to `/meetings`
2. Click "New Meeting"
3. Fill form:
   - Title: Team Standup
   - Description: Daily standup
   - Date: Tomorrow
   - Duration: 30 minutes
   - Client: (select one)
4. Submit
5. **Expected:**
   - Success notification
   - Meeting in list
   - Database record

**SQL Verification:**
```sql
SELECT * FROM meetings WHERE title = 'Team Standup';
```

#### Test 2: Edit Meeting

1. Edit a meeting
2. Change title
3. Submit
4. **Expected:** Updates reflected

#### Test 3: Delete Meeting

1. Delete a meeting
2. Confirm
3. **Expected:** Meeting removed

### Knowledge Base Tests

#### Test 1: View Knowledge Entries

1. Navigate to `/knowledge`
2. **Expected:**
   - Grid of knowledge cards
   - Categories displayed
   - Test entries visible

#### Test 2: Search Knowledge

1. Enter search term
2. **Expected:** Filtered results

#### Test 3: View Entry Details

1. Click on an entry
2. **Expected:** Full content displayed

#### Test 4: Filter by Category

1. Click on a category
2. **Expected:** Only entries from that category shown

---

## 🤖 AI Features Tests

### Test 1: AI Chat Assistant

**Prerequisites:** `OPENAI_API_KEY` must be set

1. Navigate to `/ai/chat`
2. Type message: "Hello, how can you help me?"
3. Submit
4. **Expected:**
   - Loading indicator
   - AI response appears
   - Message saved in chat history

**SQL Verification:**
```sql
SELECT * FROM ai_chat_history
ORDER BY created_at DESC
LIMIT 10;
```

### Test 2: Semantic Search

**Prerequisites:**
- `OPENAI_API_KEY` set
- `match_embeddings` function exists
- Test embeddings in database

1. Create some knowledge entries
2. Wait for embeddings to generate (or trigger manually)
3. Search for related term
4. **Expected:** Relevant results based on meaning, not just keywords

**Test via SQL:**
```sql
-- First generate an embedding for a test query
-- Then test match_embeddings
SELECT * FROM match_embeddings(
  '[embedding_vector]'::vector(1536),
  0.7,
  5
);
```

### Test 3: Meeting Summary Generation

**Prerequisites:** `OPENAI_API_KEY` set

1. Create a meeting with description/notes
2. Click "Generate Summary"
3. **Expected:**
   - Loading indicator
   - AI-generated summary
   - Key points extracted

### Test 4: AI Agent Execution

1. Navigate to AI Agents (if UI exists)
2. Select an agent (e.g., "Email Draft Assistant")
3. Provide context
4. Run agent
5. **Expected:**
   - Agent executes
   - Result displayed
   - Run logged in database

**SQL Verification:**
```sql
SELECT * FROM ai_agent_runs
ORDER BY created_at DESC
LIMIT 5;
```

---

## ⚡ Edge Functions Tests

### Test 1: validate-api-key

```bash
curl -X POST \
  https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/validate-api-key \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "test-key-12345678901234567890"}'
```

**Expected Response:**
```json
{"valid":true,"message":"API key is valid"}
```

### Test 2: send-notification

```bash
curl -X POST \
  https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_UUID",
    "title": "Test Notification",
    "message": "This is a test",
    "type": "info",
    "channels": ["in_app"]
  }'
```

**Expected:** Notification created in database

**SQL Verification:**
```sql
SELECT * FROM notifications
WHERE title = 'Test Notification';
```

### Test 3: ai-chat-assistant

```bash
curl -X POST \
  https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/ai-chat-assistant \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "session_id": "test-session-123",
    "user_id": "USER_UUID"
  }'
```

**Expected:** AI response in JSON

### Test 4: generate-embeddings

```bash
curl -X POST \
  https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/generate-embeddings \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "test",
    "entity_id": "test-123",
    "content": "This is test content for embedding generation."
  }'
```

**Expected:** Embeddings created

**SQL Verification:**
```sql
SELECT * FROM embeddings
WHERE entity_id = 'test-123';
```

---

## 🔗 Integration Tests

### Test 1: Complete User Journey

1. **Sign Up**
   - Create account
   - Verify email (if required)
   - Login

2. **Create Data**
   - Add 3 clients
   - Schedule 2 meetings
   - Create 1 knowledge entry

3. **Use AI Features**
   - Ask AI assistant a question
   - Search knowledge base
   - Generate meeting summary

4. **Manage Data**
   - Edit a client
   - Delete a meeting
   - Update knowledge entry

5. **Logout**

**Expected:** All operations complete without errors

### Test 2: Multi-User Scenario

1. Create 2 user accounts
2. User 1: Create clients and meetings
3. User 2: Try to access User 1's data
4. **Expected:** User 2 cannot see User 1's private data (RLS working)

### Test 3: Admin Workflow

1. Login as admin
2. Access admin panel (`/admin`)
3. View users list
4. Manage roles
5. **Expected:** Admin can see all users and modify roles

---

## 📊 Performance Tests

### Test 1: Load Time

1. Clear browser cache
2. Navigate to dashboard
3. Measure time to interactive
4. **Target:** < 3 seconds on 3G

### Test 2: Query Performance

```sql
-- Test client list query
EXPLAIN ANALYZE
SELECT * FROM clients
ORDER BY created_at DESC
LIMIT 50;

-- Should use index, < 100ms
```

### Test 3: Concurrent Users

1. Open 5 browser tabs
2. Login with different users
3. Perform CRUD operations simultaneously
4. **Expected:** No conflicts or errors

---

## 🔒 Security Tests

### Test 1: SQL Injection

1. Try SQL injection in search: `' OR '1'='1`
2. **Expected:** Properly escaped, no data leak

### Test 2: XSS Protection

1. Create client with name: `<script>alert('XSS')</script>`
2. **Expected:** Script not executed, properly sanitized

### Test 3: CORS

```bash
curl -X POST \
  https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/validate-api-key \
  -H "Origin: https://malicious-site.com"
```

**Expected:** CORS headers restrict to allowed origins

### Test 4: Rate Limiting

1. Make 100 rapid requests to an edge function
2. **Expected:** Rate limiting kicks in

---

## ✅ Test Checklist

Use this for manual testing before deployment:

### Database
- [ ] All tables exist
- [ ] Test data inserted
- [ ] Functions created
- [ ] Indexes optimized
- [ ] RLS policies active

### Authentication
- [ ] Email signup works
- [ ] Google OAuth works
- [ ] Login works
- [ ] Logout works
- [ ] Protected routes secured
- [ ] Admin routes restricted

### CRUD Operations
- [ ] Create client
- [ ] Edit client
- [ ] Delete client
- [ ] Create meeting
- [ ] Edit meeting
- [ ] Delete meeting
- [ ] View knowledge entries
- [ ] Search knowledge

### AI Features
- [ ] AI chat responds
- [ ] Semantic search works
- [ ] Meeting summaries generate
- [ ] AI agents execute

### Edge Functions
- [ ] All functions deployed
- [ ] Environment variables set
- [ ] Functions return correct responses
- [ ] Error handling works

### Performance
- [ ] Page load < 3 seconds
- [ ] Queries optimized
- [ ] No memory leaks
- [ ] Concurrent users supported

### Security
- [ ] SQL injection prevented
- [ ] XSS attacks blocked
- [ ] CORS configured
- [ ] Rate limiting active
- [ ] Sensitive data encrypted

---

## 🐛 Bug Reporting Template

When you find a bug, document it like this:

**Title:** Brief description

**Steps to Reproduce:**
1. Go to...
2. Click on...
3. See error...

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- Browser: Chrome 120
- OS: MacOS
- User Role: Admin
- Function: ai-chat-assistant

**Error Messages:**
```
[Error text here]
```

**Screenshots:**
[Attach if applicable]

---

**Last Updated:** 2025-12-31
**Framework Version:** V1.0
