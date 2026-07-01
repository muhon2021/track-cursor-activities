# Release Checklist (Quick Reference)

Quick checklist for weekly releases. See [release-workflow.md](./release-workflow.md) for full details.

---

## Pre-Release

- [ ] Internal project tested and stable
- [ ] No WIP (work-in-progress) features in main codebase
- [ ] Version number decided (if significant release)

---

## Release Steps

| Step | Action | Time |
|------|--------|------|
| 1 | Remix internal project | 2 min |
| 2 | Run cleanup prompt in customer project | 5 min |
| 3 | Verify deletions completed | 2 min |
| 4 | Test core features | 15 min |
| 5 | Publish customer project | 1 min |
| 6 | Tag release in docs/README.md | 1 min |

**Total: ~30 minutes**

---

## Files Deleted by Cleanup

| Category | Files | Count |
|----------|-------|-------|
| AI Instructions | `CLAUDE.MD` | 1 |
| Backlog Docs | `docs/backlog/*` | 2 |
| Archive Docs | `docs/archive/*` | 7 |
| Original Docs | `docs/original/*` | 5 |
| Reference | `.internal-only` | 1 |
| Feedback Module | Pages + Edge Function | 3 |
| **Total** | | **19** |

---

## Code Modifications

| File | Change |
|------|--------|
| `App.tsx` | Remove 2 routes (`/feedback`, `/admin/feedback`) |
| `AppSidebar.tsx` | Remove 1 sidebar item ("Feedback") |
| `AdminSidebar.tsx` | Remove 1 sidebar group ("CONTENT & FEEDBACK") |

---

## Post-Release Verification

- [ ] Dashboard loads
- [ ] Login works
- [ ] No "Feedback" in navigation
- [ ] No "Feedback Management" in admin
- [ ] No 404 errors
- [ ] AI Chat works
- [ ] Knowledge base works

---

## Rollback

If issues occur:
1. Open customer project → History tab
2. Restore version before cleanup
3. Debug and retry

---

*See [release-workflow.md](./release-workflow.md) for the full cleanup prompt and detailed instructions.*
