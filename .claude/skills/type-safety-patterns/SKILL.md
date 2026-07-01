# Type Safety Patterns Skill

## When to Use
- Before any TypeScript code is written
- When creating Supabase types, mutation handlers, or Record maps
- When adding new enum values or filter types

## Pattern 1: Supabase Query → TypeScript Type

### The Problem
A Supabase query selects fields, but the type doesn't match. Runtime errors follow.

### The Solution
1. Write the query first
2. Extract ALL fields from `.select()`
3. Create type with EXACT fields
4. Use `Pick<>` for partial joins

### Example
```typescript
// Step 1: Write query
.select(`
  id,
  name,
  task_streams(name, color, slug),
  assigned_to,
  created_at
`)

// Step 2: Extract fields
// task_streams has: name, color, slug
// tasks has: id, name, assigned_to, created_at

// Step 3: Create type
interface Task {
  id: string;
  name: string;
  task_streams: {
    name: string;
    color: string;
    slug: string;
  };
  assigned_to: string | null;
  created_at: string;
}

// ✅ Type matches query exactly
```

## Pattern 2: Record Exhaustiveness

### The Problem
You create a `Record<K, V>` but forget to include all keys from K.

### The Solution
1. Define the union/enum first
2. Create Record with type annotation
3. TypeScript FORCES you to include all keys

### Example
```typescript
// Step 1: Define union
type TaskView = 'today' | 'this_week' | 'overdue' | 'all' | 'my_tasks';

// Step 2: Create Record with type
// ❌ TypeScript error until ALL keys are present
const EMPTY_MESSAGES: Record<TaskView, EmptyMessage> = {
  today: {...},
  this_week: {...},
  overdue: {...},
  // ⚠️ Missing 'all' and 'my_tasks' — compile error
};

// ✅ Add all keys
const EMPTY_MESSAGES: Record<TaskView, EmptyMessage> = {
  today: {...},
  this_week: {...},
  overdue: {...},
  all: {...},
  my_tasks: {...},
};
```

## Pattern 3: Union Filter Types

### The Problem
A filter can be `string | string[]`, but you pass it directly to `.eq()` which only accepts `string`.

### The Solution
Branch with `Array.isArray()` before query

### Example
```typescript
// ❌ BAD
interface Filters {
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | ['Q1', 'Q2'];
}

let query = supabase.from('okrs').select('*');
query = query.eq('quarter', filters.quarter); // Type error!

// ✅ GOOD
let query = supabase.from('okrs').select('*');
if (filters.quarter) {
  if (Array.isArray(filters.quarter)) {
    query = query.in('quarter', filters.quarter);
  } else {
    query = query.eq('quarter', filters.quarter);
  }
}
```

## Pattern 4: Mutation Context Types

### The Problem
TypeScript loses the context type when callbacks are defined inline in `mutate()`.

### The Solution
Define callbacks in `useMutation()`, not in `mutate()` call

### Example
```typescript
// ❌ BAD: Context type is lost
const updateTask = useMutation({
  mutationFn: async (data) => { /* ... */ },
});

updateTask.mutate(data, {
  onMutate: () => ({ prev: oldData }),
  onError: (_err, _vars, context) => {
    // context is 'any', not { prev: Task[] }
  }
});

// ✅ GOOD: Context type inferred
const updateTask = useMutation({
  mutationFn: async (data) => { /* ... */ },
  onMutate: async (variables) => {
    return { prev: await fetchOld() }; // Return type inferred
  },
  onError: (_err, _variables, context) => {
    // context is { prev: Task[] } — fully typed
    if (context?.prev) { /* safe */ }
  }
});
```

## Pattern 5: Partial Join Selects

### The Problem
You select only 4 fields from a joined table (8 total), but use the full interface type (requires all 8).

### The Solution
Use `Pick<TableType, 'field1' | 'field2'>` for partial joins

### Example
```typescript
// ❌ BAD: Selects 4 fields, type expects 8
.select('eos_pods(id, name, color, is_active)')
interface OKR {
  pod: EOSPod; // EOSPod has 8 required fields, query only gives 4
}

// ✅ GOOD: Pick only selected fields
.select('eos_pods(id, name, color, is_active)')
interface OKR {
  pod?: Pick<EOSPod, 'id' | 'name' | 'color' | 'is_active'>;
}
```

## Checklist Before Submitting Code

- [ ] Every `.select()` field exists in the type
- [ ] Every `Record<K, V>` has entries for all K
- [ ] Union filter types branch before query
- [ ] Mutation callbacks defined in `useMutation()`, not `mutate()`
- [ ] Join types use `Pick<>` for partial selects
- [ ] No duplicate type exports
- [ ] `tsc --noEmit` passes
- [ ] `npm run build` succeeds
