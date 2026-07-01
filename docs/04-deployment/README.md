# Deployment Guide

Deploy CollabAi to production.

---

## Deployment Options

| Platform | Best For | Difficulty |
|----------|----------|------------|
| [Lovable Publish](./lovable-publish.md) | Lovable users | Easy |
| [Vercel](./vercel.md) | JAMstack, global CDN | Easy |
| [Netlify](./netlify.md) | JAMstack, forms | Easy |
| [Docker](./docker.md) | Self-hosted, Kubernetes | Medium |
| [AWS](./aws.md) | Enterprise, custom infra | Advanced |

---

## Files in This Section

| File | Description |
|------|-------------|
| [lovable-publish.md](./lovable-publish.md) | One-click Lovable deploy |
| [vercel.md](./vercel.md) | Vercel deployment |
| [netlify.md](./netlify.md) | Netlify deployment |
| [docker.md](./docker.md) | Docker containerization |
| [deployment-checklist.md](./deployment-checklist.md) | Pre-launch checklist |
| [custom-domain.md](./custom-domain.md) | Domain configuration |

---

## Quick Deploy: Lovable

1. Click **Publish** in Lovable editor
2. Your app is live at `yourproject.lovable.app`
3. (Optional) Connect custom domain

That's it! Edge functions deploy automatically.

---

## Quick Deploy: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
```

---

## Pre-Deployment Checklist

### Database
- [ ] All migrations applied (run `npm run migrations:run` or `./scripts/run-migrations.sh`)
- [ ] RLS policies configured
- [ ] Test data removed from production

### Authentication
- [ ] Email templates configured
- [ ] OAuth apps created (if using)
- [ ] Redirect URLs set correctly

### Edge Functions
- [ ] All functions deployed
- [ ] Secrets configured
- [ ] API keys are production keys

### Application
- [ ] Environment variables set
- [ ] Feature flags configured
- [ ] Admin account created

### Security
- [ ] HTTPS enabled
- [ ] CORS configured correctly
- [ ] Rate limiting enabled

### Monitoring
- [ ] Error tracking setup (optional)
- [ ] Analytics configured (optional)
- [ ] Logging enabled

---

## Running Migrations

When you add or change files in `supabase/migrations/`, apply them to your linked Supabase project:

```bash
npm run migrations:run
```

- **Success:** script prints "Migrations applied successfully" and exits 0.
- **Failure:** script prints the error output and troubleshooting hints, exits non-zero.

To run migrations automatically when you commit migration files, install the pre-commit hook once:

```bash
npm run migrations:hook
```

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and a linked project (`supabase link`).

---

## Environment Variables

Ensure these are set in your hosting platform:

```env
VITE_SUPABASE_PROJECT_ID=xxx
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=xxx
```

See [Environment Variables](../00-getting-started/environment-variables.md) for the full list.

---

## Post-Deployment

1. **Test the deployment**
   - Login works
   - All features accessible
   - API calls succeed

2. **Create admin account** (if not done)
   - Sign up via the app
   - Add admin role in database

3. **Configure branding**
   - App name and logo
   - Color scheme

4. **Invite users**
   - Send invites from Admin panel
   - Or share signup link

---

## Troubleshooting

### Build fails
- Check Node.js version (18+)
- Verify all dependencies installed
- Check for TypeScript errors

### App loads but data missing
- Verify Supabase URL and key
- Check RLS policies
- Confirm tables exist

### Edge functions fail
- Check function logs in Supabase
- Verify secrets are set
- Check for CORS issues
