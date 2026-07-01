# Claude Code Pre-Commit Checklist

Run this checklist BEFORE committing any Claude Code session output.

## Supabase Queries → TypeScript Types

- [ ] For every `.select('...')`, verify the type has ALL selected fields
- [ ] For joined tables, verify the type includes all joined columns
- [ ] If query selects a subset of a table, use `Pick<Table, 'field1' | 'field2'>` in the type
- [ ] Check for `// @ts-ignore` — if present, fix the type instead
- [ ] Run `tsc --noEmit` to catch type errors before commit

**Examples:**
```typescript
// ❌ BAD: Query selects `slug`, type doesn't have it
.select('task_streams(name, color, slug)')
interface Task { stream: { name: string; color: string } } // Missing slug!

// ✅ GOOD: Type matches query
.select('task_streams(name, color, slug)')
interface Task { stream: { name: string; color: string; slug: string } }

// ✅ GOOD: Partial select uses Pick
.select('eos_pods(id, name, color, is_active)') // Only 4 fields
interface OKR { pod?: Pick<EOSPod, 'id' | 'name' | 'color' | 'is_active'> }
```

## TypeScript Completeness

- [ ] For every `Record<K, V>`, verify ALL keys in K have entries
  - Or use `Partial<Record<K, V>>` if some are optional
- [ ] For every `enum`, find all `Record` maps that use it and verify they're in sync
- [ ] No duplicate type exports in the same file
- [ ] All `const` objects typed as `Record` have type annotations: `as const`

**Examples:**
```typescript
// ❌ BAD: Missing 'all' and 'my_tasks' keys
type TaskView = 'today' | 'this_week' | 'overdue' | 'all' | 'my_tasks';
const EMPTY_MESSAGES: Record<TaskView, EmptyMessage> = {
  today: {...},
  this_week: {...},
  // Missing 'all' and 'my_tasks' — TypeScript error!
};

// ✅ GOOD: All keys present
const EMPTY_MESSAGES: Record<TaskView, EmptyMessage> = {
  today: {...},
  this_week: {...},
  overdue: {...},
  all: {...},
  my_tasks: {...},
};

// ✅ GOOD: Optional keys
const OPTIONAL_MESSAGES: Partial<Record<TaskView, EmptyMessage>> = {
  today: {...},
  // Other keys are optional
};
```

## Filter Types → Query Methods

- [ ] For every filter parameter, check its type:
  - If `string`, use `.eq(key, value)`
  - If `string[]`, use `.in(key, value)`
  - If `string | string[]`, use `Array.isArray()` to branch
- [ ] No filter type is passed directly to a query method without validation

**Examples:**
```typescript
// ❌ BAD: Union type passed directly
const filters = { quarter: 'Q1' | ['Q1', 'Q2'] };
.eq('quarter', filters.quarter) // Error: can't pass union!

// ✅ GOOD: Branching logic
if (Array.isArray(filters.quarter)) {
  query = query.in('quarter', filters.quarter);
} else {
  query = query.eq('quarter', filters.quarter);
}
```

## Mutation Callbacks & Optimistic Updates

- [ ] If using `onMutate`/`onError`/`onSettled`, define them in `useMutation()`, not in `mutate()` call
- [ ] If `onMutate` returns context, verify `onError` receives it (via `context` param)
- [ ] Use `cast as const` for context type safety if needed

**Examples:**
```typescript
// ❌ BAD: Callbacks defined inline
updateTask.mutate(
  { id, data },
  {
    onMutate: () => { /* ... */ }, // TypeScript loses context type
    onError: (_err, _vars, context) => { /* context is any */ }
  }
);

// ✅ GOOD: Callbacks in useMutation definition
const updateTask = useMutation({
  mutationFn: async ({ id, data }) => { /* ... */ },
  onMutate: async (variables) => {
    return { prev: oldData }; // TypeScript infers context type
  },
  onError: (_err, _variables, context) => {
    if (context?.prev) { /* safe to use */ }
  }
});
```

## Join Type Audits

- [ ] After modifying a join type, trace it to:
  - [ ] All queries that select from that join
  - [ ] All components that access properties from the join
  - [ ] All test files that mock the join
- [ ] If adding a new field to a join, search codebase for all uses of that type
- [ ] Never assume a join has only the fields you see in one query

## Enum Usage Audit

- [ ] After adding a new enum value, search for ALL `Record<EnumType, ...>` maps
- [ ] Update every map with the new key
- [ ] Use global search: `Record<dealstage` or similar (case-insensitive)

---

## Pre-Commit Test

Run before `git commit`:
```bash
# 1. Check TypeScript
npm run lint

# 2. Check build
npm run build:dev

# 3. If anything fails, DO NOT COMMIT
# Fix the issue, re-run tests, then commit
```

---

## When to Escalate

If any of these checks fails:
1. Fix it in the Claude Code session
2. Re-run tests to verify
3. If you can't fix it, ask the code-reviewer agent to audit

Never merge with TypeScript errors.
