---
version: 1.0.0
name: Control-Tower-design-analysis
description: An agentic-SaaS interface anchored on a white canvas with Electric Blue (HSL 199 89% 48%) primary and Cyan (HSL 187 100% 42%) accent. Surfaces stay calm and crisp, typography stays Inter with a confident geometric voice on display sizes, and brand voltage comes from pulsing AI status indicators rather than from heavy color blocks. Cards are soft (12px default radius), shadows are restrained, and motion is purposeful — fast transitions for UI, slow 2s loops for agentic presence.

colors:
  background: "0 0% 100%"
  foreground: "222 47% 11%"
  card: "0 0% 100%"
  popover: "0 0% 100%"
  primary: "199 89% 48%"
  primary-foreground: "0 0% 100%"
  secondary: "210 40% 96%"
  secondary-foreground: "222 47% 11%"
  muted: "210 40% 96%"
  muted-foreground: "215 16% 47%"
  accent: "187 100% 42%"
  accent-foreground: "0 0% 100%"
  border: "214 32% 91%"
  input: "214 32% 91%"
  ring: "199 89% 48%"
  sidebar-background: "210 40% 98%"
  ai-glow: "199 89% 48%"
  ai-pulse: "187 100% 42%"
  success: "158 64% 52%"
  warning: "43 96% 56%"
  destructive: "0 84% 60%"
  info: "199 89% 48%"

typography:
  display-xl: { fontFamily: "Inter", fontSize: 60px, fontWeight: 700, lineHeight: 1.05, letterSpacing: -0.04em }
  display-lg: { fontFamily: "Inter", fontSize: 48px, fontWeight: 700, lineHeight: 1.1,  letterSpacing: -0.03em }
  display-md: { fontFamily: "Inter", fontSize: 36px, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.02em }
  display-sm: { fontFamily: "Inter", fontSize: 28px, fontWeight: 600, lineHeight: 1.2,  letterSpacing: -0.01em }
  title-lg:   { fontFamily: "Inter", fontSize: 22px, fontWeight: 600, lineHeight: 1.3,  letterSpacing: -0.005em }
  title-md:   { fontFamily: "Inter", fontSize: 18px, fontWeight: 600, lineHeight: 1.4,  letterSpacing: 0 }
  title-sm:   { fontFamily: "Inter", fontSize: 16px, fontWeight: 600, lineHeight: 1.4,  letterSpacing: 0 }
  body-md:    { fontFamily: "Inter", fontSize: 16px, fontWeight: 400, lineHeight: 1.5,  letterSpacing: 0 }
  body-sm:    { fontFamily: "Inter", fontSize: 14px, fontWeight: 400, lineHeight: 1.5,  letterSpacing: 0 }
  caption:    { fontFamily: "Inter", fontSize: 12px, fontWeight: 500, lineHeight: 1.4,  letterSpacing: 0.01em }
  button:     { fontFamily: "Inter", fontSize: 14px, fontWeight: 600, lineHeight: 1.0,  letterSpacing: 0 }
  code:       { fontFamily: "JetBrains Mono", fontSize: 13px, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 }

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px
  full: 9999px

shadow:
  none: none
  xs: 0 1px 2px hsl(222 47% 11% / 0.05)
  sm: 0 2px 4px hsl(222 47% 11% / 0.06)
  md: 0 4px 12px hsl(222 47% 11% / 0.08)
  lg: 0 10px 24px hsl(222 47% 11% / 0.10)
  xl: 0 20px 40px hsl(222 47% 11% / 0.14)
  ai-glow: 0 0 24px hsl(199 89% 48% / 0.45)

motion:
  duration:
    instant: 80ms
    fast: 150ms
    base: 240ms
    slow: 360ms
    ai-pulse: 2s
  easing:
    standard: cubic-bezier(0.2, 0, 0, 1)
    emphasized: cubic-bezier(0.3, 0, 0, 1)
    decelerated: cubic-bezier(0, 0, 0.2, 1)
    accelerated: cubic-bezier(0.4, 0, 1, 1)
---

## Overview

Control Tower's interface is an agentic operating surface — white canvas (`{colors.background}`), Electric Blue primary (`{colors.primary}` — HSL 199 89% 48%), Cyan accent (`{colors.accent}` — HSL 187 100% 42%), and Inter as the only text family. The visual voice is **calm UI, loud agents**: surfaces stay quiet so the pulsing AI indicators read clearly when an agent is thinking, watching, or acting.

Type voice is single-family: **Inter** across display, title, body, button, and caption. Display sizes (28px → 60px) use 600–700 weight with negative letter-spacing (-0.01em to -0.04em) for a geometric, modern feel. Body sits at 400 / 16px / 1.5 line-height. Code uses **JetBrains Mono** for tokens, payloads, and API examples.

Brand voltage comes from **agentic indicators** — small pulsing dots in the AI glow color with the `ai-glow` shadow, looping at 2s. They appear on agent cards, in chat headers, and on the sidebar's "AI Agents" group. Outside of those indicators, the color story is restrained: blue primary on CTAs, secondary cool-gray on chips and tabs, status colors used sparingly.

**Key characteristics**
- White canvas, Electric Blue primary CTA, Cyan agentic accent. Default radius is 12px (`{rounded.lg}`).
- Inter only for text. Cal Sans-style display feel achieved via weight 600–700 + negative tracking.
- Cards default to white with a 1px hairline border (`{colors.border}`) and a soft `sm` shadow.
- Pulsing AI indicators (`ai-glow` shadow + 2s loop) carry the agentic identity.
- Sidebar surface is slightly cooler (`{colors.sidebar-background}`) than canvas.
- Section rhythm is 96px (`{spacing.section}`); card padding is 24px.

## Colors

### Brand & Accent
- **primary** (`hsl(199 89% 48%)`) — Electric Blue. All primary CTAs, links, focus rings.
- **accent** (`hsl(187 100% 42%)`) — Cyan glow. Agentic accent on pulses, AI badges, secondary highlights.
- **ai-glow / ai-pulse** — Mirror primary / accent. Used in pulsing indicator components only.

### Surface
- **background** — Page canvas (white).
- **card** — Default content surface (white).
- **secondary / muted** — Soft cool-gray (`hsl(210 40% 96%)`) for tabs, chips, dense UI.
- **sidebar-background** — Slightly cooler than canvas (`hsl(210 40% 98%)`).

### Text
- **foreground** — Ink (`hsl(222 47% 11%)`). All primary text.
- **muted-foreground** — Secondary (`hsl(215 16% 47%)`). Captions, helper copy.

### Border & Input
- **border / input** — Hairline (`hsl(214 32% 91%)`).
- **ring** — Focus ring, mirrors primary.

### Status
- **success** `hsl(158 64% 52%)` · **warning** `hsl(43 96% 56%)` · **destructive** `hsl(0 84% 60%)` · **info** mirrors primary.

## Typography

Inter is the only text family. The split is functional:
- Display sizes (28–60px, weight 600–700, negative tracking) — page titles and hero heads.
- Title sizes (16–22px, weight 600) — card and panel labels.
- Body sizes (14–16px, weight 400, line-height 1.5) — running text.
- Caption (12px / 500 / 0.01em tracking) — badges, tags.
- Button (14px / 600 / line-height 1) — action labels.
- Code (JetBrains Mono 13px) — tokens, payloads.

Display weight steps from 700 (`display-xl/lg`) to 600 (`display-md/sm`). Negative tracking is essential at display sizes; without it the type reads as off-brand.

## Layout

- **Base unit:** 4px.
- **Section padding:** `{spacing.section}` (96px) between major bands.
- **Card padding:** `{spacing.lg}` (24px) default; `{spacing.xl}` (32px) for hero cards.
- **Gutters:** `{spacing.lg}` (24px) between cards in 3-up grids.
- **Max content width:** ~1280px centered on dashboard pages.

## Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow | Page bands, sidebar |
| Hairline | 1px `{colors.border}` | Inputs, dividers, cards at rest |
| `sm` | `0 2px 4px hsl(222 47% 11% / 0.06)` | Cards at rest |
| `md` | `0 4px 12px hsl(222 47% 11% / 0.08)` | Hover, elevated cards |
| `lg` | `0 10px 24px hsl(222 47% 11% / 0.10)` | Popovers, menus |
| `xl` | `0 20px 40px hsl(222 47% 11% / 0.14)` | Modals, dialogs |
| `ai-glow` | `0 0 24px hsl(199 89% 48% / 0.45)` | Pulsing AI indicators only |

## Shapes

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Inline badges |
| `{rounded.sm}` | 6px | Dropdown items |
| `{rounded.md}` | 8px | Inputs, secondary buttons |
| `{rounded.lg}` | 12px | **Default** — cards, primary buttons (matches `--radius`) |
| `{rounded.xl}` | 16px | Hero cards, large surfaces |
| `{rounded.pill}` | 9999px | Pill tabs, status badges |
| `{rounded.full}` | 9999px | Avatars, icon buttons |

## Components

### Buttons
- **button-primary** — `{colors.primary}` fill, white label, 12px radius, 40px height, weight 600 / 14px.
- **button-secondary** — `{colors.secondary}` fill, ink label, same shape.
- **button-ghost** — Transparent, ink label, hover swap to `{colors.muted}`.

### Card
- White fill, 1px hairline border, 12px radius, `sm` shadow, 24px padding.

### Input
- White fill, 1px `{colors.input}` border, 8px radius, 40px height. On focus, ring uses `{colors.ring}`.

### AI Indicator
- 8px circle, fill `{colors.ai-glow}`, shadow `ai-glow`, looping pulse animation at 2s linear infinite.
- Appears beside agent names, in the sidebar "AI Agents" group label, and in chat headers when an agent is reasoning.

### Badge
- `{colors.secondary}` fill, ink label, pill radius, caption typography, 4×10 padding.

### Sidebar
- `{colors.sidebar-background}` surface, collapsible groups, persists open state in `localStorage`.
- Agentic groups carry an `isAI` flag that renders a pulsing AI indicator next to the section label.

## Motion

- Duration tokens: `instant` 80ms · `fast` 150ms · `base` 240ms · `slow` 360ms · `ai-pulse` 2s.
- Easing tokens: `standard`, `emphasized`, `decelerated`, `accelerated`.
- Default interactive transition: `all 150ms standard`.
- AI indicators loop at `ai-pulse` duration with `linear` easing.

## Accessibility

- Primary on white passes WCAG AA for non-text contrast (focus rings, icons).
- Foreground on background = AAA.
- Muted-foreground on background = AA for body text.
- Focus rings always use `{colors.ring}` (mirrors primary) at 2px offset.
- Reduced motion: pulse and slide animations must respect `prefers-reduced-motion: reduce`.

## Voice

Calm UI. Loud agents. Surfaces stay quiet so agentic presence reads clearly. When in doubt: less color, more space, more pulse.
