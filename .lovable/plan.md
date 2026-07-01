## Landing Page — Control Tower

Build a new public landing page at `/` (replacing the current Index route) based on the pitch deck. Single long-scroll page with 10 sections mirroring the deck, plus a sticky top nav and footer.

### Sections (in order)
1. **Hero** — "One Control Tower for every tool your team already uses." Subhead from p.1. Primary CTA "Book a 20-min demo" → `https://collabai.software/book-demo`, secondary "Sign in" → `/login`. Animated logo cloud strip beneath.
2. **Problem** — "Your data lives in 10+ tools. None of them talk to each other." Grid of 14 tool name chips. Big stat: "6+ apps to answer one question."
3. **The Fix** — "One place to see everything." Two-column: left bulleted categories (CRM / Trackers / Meetings / Docs / Comms), right Control Tower feature card list.
4. **Differentiators** — 3 numbered cards: Unified View, Knowledge Base, Agentic Action.
5. **It Does the Work** — 6-card bento grid (Unified Analytics, Semantic Search, Auto-Indexed Meetings, Generated Artifacts, Agent-Ready Context, MCP & Integrations).
6. **Model-Agnostic** — "One Knowledge Base. Every model." OpenAI / Anthropic / Gemini badges over shared pgVector strip.
7. **Connected** — 16 integration tiles (HubSpot, Salesforce, Zoho, Pipedrive, Jira, Confluence, ClickUp, ActiveCollab, Zoom, Teams, Meet, Slack, Drive, SharePoint, Outlook, MCP).
8. **Agents** — "24+ specialized agents" with 8 named agent cards + "+16 more" tag.
9. **Trust** — 6 enterprise cards (SSO, Audit Logs, Signed-URL Storage, Multi-tenant RLS, Private Deployment, BYOK).
10. **Final CTA** — "See your scattered tools become one Control Tower." Book demo button.
11. **Footer** — CollabAI · Control Tower, links to Login, Demo, Terms.

### Design direction
- Dark, agentic aesthetic aligned with existing tokens (HSL 199 primary, HSL 187 accent, pulsing indicators per project memory).
- Distinctive typography pair (e.g., Space Grotesk display + Inter body) — not generic.
- Subtle animated gradient mesh in hero, layered glass cards, pulsing dots on "live" indicators.
- All colors via semantic tokens in `index.css` / `tailwind.config.ts` — no hardcoded hex in components.
- Framer-motion fade/slide-in on scroll for section reveals.

### Files
- **New**: `src/pages/LandingPage.tsx` (composes section components)
- **New**: `src/components/landing/sections/` — `Hero.tsx`, `Problem.tsx`, `Fix.tsx`, `Differentiators.tsx`, `Capabilities.tsx`, `ModelAgnostic.tsx`, `Integrations.tsx`, `Agents.tsx`, `Trust.tsx`, `FinalCta.tsx`, `LandingNav.tsx`, `LandingFooter.tsx`
- **Edit**: `src/components/routing/AppRoutes.tsx` — route `/` to new `LandingPage` for unauthenticated users; authenticated users continue to dashboard
- **Edit**: `index.css` / `tailwind.config.ts` — add any missing landing-only tokens (gradient mesh, glow)
- **Edit**: `index.html` — SEO title (<60), meta description (<160), OG tags

### Out of scope
- No backend/database changes, no new edge functions, no auth changes.
- Existing `src/components/landing/*` (Hero/FeatureGrid/etc.) left untouched; new sections live under `sections/` subfolder to avoid breaking other consumers.
- No PDF images copied into the app — icons rendered with lucide-react + simple SVG monograms.

### How to test
- Visit `/` while signed out → see new landing page.
- All CTAs land correctly (`/login`, external demo link).
- Lighthouse: single H1, alt text, semantic landmarks, mobile responsive.
