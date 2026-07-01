# Release Process: Internal → Customer Project

This document provides an overview of the release process. For step-by-step instructions, see:

- **[release-workflow.md](./release-workflow.md)** - Full workflow with cleanup prompt
- **[release-checklist.md](./release-checklist.md)** - Quick reference checklist

## Overview
We maintain two separate Lovable projects:

| Project | Purpose | Access |
|---------|---------|--------|
| **SJ Control Tower** | Internal development | SJ Innovation team only |
| **CollabAi Framework** | Customer-facing template | Public (remixable) |

## Files to Exclude from Customer Project

Reference `.internal-only` in the project root for the definitive list:

```
CLAUDE.MD              # AI development instructions
docs/backlog/          # Product roadmap and sprint planning
docs/archive/          # Session summaries, implementation notes
docs/original/         # Original SJ Innovation Framework specs
.env                   # Actual API keys (use .env.example instead)
.internal-only         # This reference file
```

## Release Checklist

### Before Syncing

- [ ] All features to be released are complete and tested
- [ ] No internal references in code comments
- [ ] No SJ Innovation-specific branding in UI
- [ ] `.env.example` contains only generic placeholders

### Sync Process

1. **Open both projects** in separate browser tabs:
   - Internal: SJ Control Tower
   - Customer: CollabAi Framework

2. **Sync source code** (copy from Internal → Customer):
   - `src/` - All frontend code
   - `supabase/functions/` - Edge functions
   - `public/` - Static assets

3. **Sync documentation** (selective):
   - ✅ Copy: `docs/00-getting-started/` through `docs/08-edge-functions/`
   - ❌ Skip: `docs/backlog/`, `docs/archive/`, `docs/original/`

4. **Sync config files**:
   - `tailwind.config.ts`
   - `vite.config.ts`
   - `eslint.config.js`
   - `.env.example` (verify no real keys)

5. **Do NOT sync**:
   - `CLAUDE.MD`
   - `.internal-only`
   - `.env`
   - Any files in excluded folders

### After Syncing

- [ ] Test core features in customer project
- [ ] Verify no internal references visible
- [ ] Publish customer project
- [ ] Update version number in docs/README.md

## Customer Distribution Options

After syncing, customers can:

### Option A: Lovable Remix
1. Visit the published customer project
2. Click "Remix" 
3. Deploy with Lovable Cloud

### Option B: GitHub Clone
1. Connect customer project to public GitHub repo
2. Customers clone the repo
3. Self-host with their own Supabase instance

## Version Numbering

Use semantic versioning in `docs/README.md`:

- **Major (X.0.0)**: Breaking changes, new architecture
- **Minor (0.X.0)**: New features, non-breaking
- **Patch (0.0.X)**: Bug fixes, minor improvements

---

*Last updated: January 2025*
