# Weekly Release Workflow

This guide describes how to release a customer-ready version of CollabAi Framework from the internal development project.

## Schedule

- **When**: Every Friday (or before customer demos)
- **Duration**: ~30 minutes
- **Who**: Any team developer

---

## Step 1: Remix from Internal Project

1. Open **SJ Control Tower** project in Lovable
2. Click project name (top-left) → Settings → "Remix this project"
3. Name: "CollabAi Framework" (or overwrite existing customer project)
4. Wait for remix to complete

---

## Step 2: Run Cleanup Prompt

After remix completes, paste the following prompt into the customer project's Lovable chat:

---

### CLEANUP PROMPT

Copy and paste everything between the dashed lines:

---

```
Please clean up this project for customer distribution. Remove all internal-only files and code:

**DELETE these files/folders:**
1. `CLAUDE.MD`
2. `docs/backlog/` (entire folder)
3. `docs/archive/` (entire folder)
4. `docs/original/` (entire folder)
5. `.internal-only`
6. `src/pages/Feedback.tsx`
7. `src/pages/admin/FeedbackManagement.tsx`
8. `supabase/functions/send-feedback-notification/` (entire folder)

**MODIFY these files:**

1. **App.tsx** - Remove these routes:
   - Remove the import for `Feedback` from "@/pages/Feedback"
   - Remove the import for `FeedbackManagement` from "@/pages/admin/FeedbackManagement"
   - Remove the `/feedback` Route element
   - Remove the `/admin/feedback` Route element

2. **src/components/layout/AppSidebar.tsx** - Remove Feedback sidebar item:
   - Delete the object with `title: "Feedback"` and `url: "/feedback"` from the sidebarItems array

3. **src/components/layout/AdminSidebar.tsx** - Remove Feedback section:
   - Delete the entire group with `title: "CONTENT & FEEDBACK"` from the sidebarGroups array

**VERIFY after cleanup:**
- No "SJ Innovation" text in any visible UI
- No internal documentation references
- Dashboard loads without errors
- Admin panel has no "Feedback Management" link
- Navigation has no "Feedback" link
```

---

## Step 3: Test Customer Project

After cleanup completes, verify these features work:

- [ ] Dashboard loads correctly
- [ ] Login/signup works
- [ ] Navigation sidebar has no "Feedback" link
- [ ] Admin panel has no "Feedback Management" link
- [ ] No 404 errors when navigating between pages
- [ ] Knowledge base works
- [ ] Meetings module works
- [ ] AI Chat works
- [ ] Settings page works

## Step 4: Publish

1. Click the "Publish" button in Lovable
2. Verify the live URL works correctly
3. Update version number in `docs/README.md` if this is a significant release

---

## Rollback Procedure

If something breaks after cleanup:

1. Go to **History** tab in the customer project
2. Find the version before cleanup was run
3. Click "Restore" on that version
4. Debug the issue
5. Update the cleanup prompt if needed
6. Try again

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    WEEKLY RELEASE FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FRIDAY MORNING                                              │
│  ┌──────────────────┐                                       │
│  │ SJ Control Tower │ ← Your daily development              │
│  │ (Internal)       │                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           │ Click "Remix"                                    │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │ CollabAi Framework│ ← Fresh copy created                 │
│  │ (Customer)       │                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           │ Paste cleanup prompt                             │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │ Lovable AI runs  │ ← Deletes internal files              │
│  │ cleanup prompt   │   Removes Feedback module              │
│  └────────┬─────────┘   Updates routes & sidebars           │
│           │                                                  │
│           │ Test & Verify                                    │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │ Publish          │ ← Customer project live               │
│  └──────────────────┘                                       │
│                                                              │
│  CUSTOMERS CAN NOW:                                          │
│  • Remix from published project                              │
│  • Clone from connected GitHub repo                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Updating the Cleanup Prompt

When you add new internal-only modules:

1. Update `.internal-only` in the internal project
2. Update this cleanup prompt to include:
   - New files to delete
   - New routes to remove
   - New sidebar entries to remove
3. Test the updated prompt on a test remix

---

## FAQ

**Q: Can I skip the cleanup and just publish the internal project?**
A: No. The internal project contains sensitive documentation, AI instructions, and internal-only modules that should not be visible to customers.

**Q: What if the cleanup prompt fails?**
A: Use Lovable's History feature to restore, then manually make the changes or fix the prompt.

**Q: How do I add a new internal-only module?**
A: Add it to `.internal-only`, update this cleanup prompt, and test on a remix.

---

*Last updated: January 2025*
