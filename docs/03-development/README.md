# Development Guide

For contributors and developers working on CollabAi.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| npm or bun | Latest | Package manager |
| Supabase CLI | Latest | Database & functions |
| Git | Latest | Version control |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/collabai.git
cd collabai

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

---

## Files in This Section

| File | Description |
|------|-------------|
| [code-style.md](./code-style.md) | Coding conventions |
| [project-structure.md](./project-structure.md) | Directory layout |
| [adding-features.md](./adding-features.md) | How to add new features |
| [database-migrations.md](./database-migrations.md) | Schema changes |
| [edge-functions.md](./edge-functions.md) | Serverless functions |
| [testing.md](./testing.md) | Testing guide |
| [ai-context.md](./ai-context.md) | AI assistant context |

---

## Project Structure

```
collabai/
├── src/
│   ├── components/      # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── layout/      # Layout components
│   │   └── [feature]/   # Feature-specific components
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Route pages
│   ├── contexts/        # React contexts
│   ├── lib/             # Utility functions
│   └── integrations/    # Supabase client & types
├── supabase/
│   ├── functions/       # Edge functions
│   └── migrations/      # Database migrations
├── docs/                # Documentation
└── public/              # Static assets
```

---

## Code Conventions

### Components
- Use functional components with TypeScript
- One component per file
- Use shadcn/ui components from `@/components/ui`
- Follow the existing naming patterns

### Hooks
- Prefix with `use` (e.g., `useClients`)
- Put in `src/hooks/`
- Export from `src/hooks/index.ts`

### Styling
- Use Tailwind CSS classes
- Use semantic design tokens from `index.css`
- Never hardcode colors - use CSS variables

### Data Fetching
- Use TanStack Query
- Create custom hooks for data operations
- Handle loading and error states

---

## Adding a New Feature

### 1. Database (if needed)
```sql
-- Create migration
CREATE TABLE new_feature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
ON new_feature FOR SELECT
USING (auth.uid() = user_id);
```

### 2. Types
Types are auto-generated from the database schema.

### 3. Hook
```typescript
// src/hooks/useNewFeature.ts
export function useNewFeature() {
  return useQuery({
    queryKey: ['new-feature'],
    queryFn: async () => {
      const { data } = await supabase.from('new_feature').select();
      return data;
    }
  });
}
```

### 4. Component
```typescript
// src/pages/NewFeature.tsx
export default function NewFeature() {
  const { data, isLoading } = useNewFeature();
  // ...
}
```

### 5. Route
Add to `App.tsx`:
```typescript
<Route path="/new-feature" element={<NewFeature />} />
```

---

## Edge Functions

### Creating a Function
```typescript
// supabase/functions/my-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Handle request
  return new Response(JSON.stringify({ success: true }));
});
```

### Deploying
```bash
supabase functions deploy my-function
```

---

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/hooks/useClients.test.ts
```

---

## Submitting Changes

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request
5. Wait for review

---

## Getting Help

- Check existing documentation
- Search GitHub issues
- Ask in Discord
