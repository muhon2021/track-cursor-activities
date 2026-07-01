/**
 * Control Tower — Design Tokens
 *
 * Single source of truth for the human-facing design-token reference.
 * Mirrors `docs/design/control-tower-design-tokens.md`.
 *
 * Token VALUES (hex) are the *display* representation. Runtime theming
 * lives in `src/index.css` as HSL CSS variables — this file is the
 * documentation layer rendered at /admin/design-tokens.
 */

export interface ColorToken {
  name: string;
  cssVar: string;
  hex: string;
  hsl: string;
  description: string;
}

export interface TypeToken {
  name: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number | string;
  letterSpacing: string;
  use: string;
}

export interface ScaleToken {
  name: string;
  value: string;
  use: string;
}

export interface ComponentToken {
  name: string;
  description: string;
  tokens: Record<string, string>;
}

// ---------- Colors ----------

export const colorGroups: { group: string; tokens: ColorToken[] }[] = [
  {
    group: "Brand & Accent",
    tokens: [
      {
        name: "primary",
        cssVar: "--primary",
        hex: "#0EA5E9",
        hsl: "199 89% 48%",
        description: "Electric Blue. Primary CTAs, links, focus rings, key actions.",
      },
      {
        name: "primary-foreground",
        cssVar: "--primary-foreground",
        hex: "#FFFFFF",
        hsl: "0 0% 100%",
        description: "Text/icon color on primary fills.",
      },
      {
        name: "accent",
        cssVar: "--accent",
        hex: "#06B6D4",
        hsl: "187 100% 42%",
        description: "Cyan glow. Agentic accent — pulses, highlights, AI badges.",
      },
      {
        name: "ai-glow",
        cssVar: "--ai-glow",
        hex: "#0EA5E9",
        hsl: "199 89% 48%",
        description: "AI status indicator core color.",
      },
      {
        name: "ai-pulse",
        cssVar: "--ai-pulse",
        hex: "#06B6D4",
        hsl: "187 100% 42%",
        description: "AI pulse animation accent.",
      },
    ],
  },
  {
    group: "Surface",
    tokens: [
      {
        name: "background",
        cssVar: "--background",
        hex: "#FFFFFF",
        hsl: "0 0% 100%",
        description: "Canvas. Default page floor.",
      },
      {
        name: "card",
        cssVar: "--card",
        hex: "#FFFFFF",
        hsl: "0 0% 100%",
        description: "Card surfaces — pure white with crisp edges.",
      },
      {
        name: "secondary",
        cssVar: "--secondary",
        hex: "#F1F5F9",
        hsl: "210 40% 96%",
        description: "Soft cool-gray surface for tabs, secondary buttons, chips.",
      },
      {
        name: "muted",
        cssVar: "--muted",
        hex: "#F1F5F9",
        hsl: "210 40% 96%",
        description: "Subdued blue-gray background — empty states, skeletons.",
      },
      {
        name: "sidebar-background",
        cssVar: "--sidebar-background",
        hex: "#F8FAFC",
        hsl: "210 40% 98%",
        description: "Sidebar surface — slightly cooler than canvas.",
      },
      {
        name: "popover",
        cssVar: "--popover",
        hex: "#FFFFFF",
        hsl: "0 0% 100%",
        description: "Floating surfaces — menus, tooltips, popovers.",
      },
    ],
  },
  {
    group: "Text",
    tokens: [
      {
        name: "foreground",
        cssVar: "--foreground",
        hex: "#0F172A",
        hsl: "222 47% 11%",
        description: "Ink. All headlines and primary text.",
      },
      {
        name: "muted-foreground",
        cssVar: "--muted-foreground",
        hex: "#64748B",
        hsl: "215 16% 47%",
        description: "Secondary text — sub-headings, captions, helper copy.",
      },
      {
        name: "secondary-foreground",
        cssVar: "--secondary-foreground",
        hex: "#0F172A",
        hsl: "222 47% 11%",
        description: "Text on secondary surfaces.",
      },
    ],
  },
  {
    group: "Border & Input",
    tokens: [
      {
        name: "border",
        cssVar: "--border",
        hex: "#E2E8F0",
        hsl: "214 32% 91%",
        description: "Hairline divider on light surfaces.",
      },
      {
        name: "input",
        cssVar: "--input",
        hex: "#E2E8F0",
        hsl: "214 32% 91%",
        description: "Input border tone.",
      },
      {
        name: "ring",
        cssVar: "--ring",
        hex: "#0EA5E9",
        hsl: "199 89% 48%",
        description: "Focus ring color — matches primary.",
      },
    ],
  },
  {
    group: "Status",
    tokens: [
      {
        name: "success",
        cssVar: "--success",
        hex: "#34D399",
        hsl: "158 64% 52%",
        description: "Confirmations, healthy states.",
      },
      {
        name: "warning",
        cssVar: "--warning",
        hex: "#FACC15",
        hsl: "43 96% 56%",
        description: "Caution callouts, attention badges.",
      },
      {
        name: "destructive",
        cssVar: "--destructive",
        hex: "#EF4444",
        hsl: "0 84% 60%",
        description: "Errors, destructive actions, validation failures.",
      },
      {
        name: "info",
        cssVar: "--info",
        hex: "#0EA5E9",
        hsl: "199 89% 48%",
        description: "Informational badges (mirrors primary).",
      },
    ],
  },
];

// ---------- Typography ----------

export const typeScale: TypeToken[] = [
  {
    name: "display-xl",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "60px",
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    use: "Hero h1 (marketing-style heros, dashboard splashes).",
  },
  {
    name: "display-lg",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "48px",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    use: "Section heads, page titles in editorial layouts.",
  },
  {
    name: "display-md",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "36px",
    fontWeight: 600,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    use: "Sub-section heads, dashboard h1.",
  },
  {
    name: "display-sm",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "28px",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    use: "Card group heads, modal titles.",
  },
  {
    name: "title-lg",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "-0.005em",
    use: "Panel titles, key card headers.",
  },
  {
    name: "title-md",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "18px",
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "0",
    use: "Card titles, dialog labels.",
  },
  {
    name: "title-sm",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "16px",
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "0",
    use: "List labels, section sub-headers.",
  },
  {
    name: "body-md",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "16px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0",
    use: "Default running-text.",
  },
  {
    name: "body-sm",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0",
    use: "Table cells, helper text, dense UI.",
  },
  {
    name: "caption",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: "0.01em",
    use: "Badges, tags, fine-print.",
  },
  {
    name: "button",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: "0",
    use: "Button labels.",
  },
  {
    name: "code",
    fontFamily: "JetBrains Mono, ui-monospace, monospace",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0",
    use: "Code blocks, API snippets, tokens.",
  },
];

// ---------- Spacing ----------

export const spacingScale: ScaleToken[] = [
  { name: "xxs", value: "4px", use: "Icon gutter inside buttons." },
  { name: "xs", value: "8px", use: "Compact element gap." },
  { name: "sm", value: "12px", use: "Form control inner padding." },
  { name: "md", value: "16px", use: "Default block gap." },
  { name: "lg", value: "24px", use: "Card padding, grid gutter." },
  { name: "xl", value: "32px", use: "Section internal padding." },
  { name: "xxl", value: "48px", use: "Hero band padding." },
  { name: "section", value: "96px", use: "Vertical rhythm between major bands." },
];

// ---------- Radius ----------

export const radiusScale: ScaleToken[] = [
  { name: "xs", value: "4px", use: "Inline badges." },
  { name: "sm", value: "6px", use: "Small chips, dropdown items." },
  { name: "md", value: "8px", use: "Inputs, secondary buttons." },
  { name: "lg", value: "12px", use: "Default — `--radius` token. Cards, primary buttons." },
  { name: "xl", value: "16px", use: "Hero containers, large surfaces." },
  { name: "pill", value: "9999px", use: "Pill tabs, status badges." },
  { name: "full", value: "9999px", use: "Avatars, icon buttons." },
];

// ---------- Shadow ----------

export const shadowScale: ScaleToken[] = [
  { name: "none", value: "none", use: "Flat surfaces, top nav, hero bands." },
  { name: "xs", value: "0 1px 2px hsl(222 47% 11% / 0.05)", use: "Subtle lift — inputs on focus." },
  { name: "sm", value: "0 2px 4px hsl(222 47% 11% / 0.06)", use: "Cards at rest." },
  { name: "md", value: "0 4px 12px hsl(222 47% 11% / 0.08)", use: "Elevated cards, hover states." },
  { name: "lg", value: "0 10px 24px hsl(222 47% 11% / 0.10)", use: "Popovers, dropdowns." },
  { name: "xl", value: "0 20px 40px hsl(222 47% 11% / 0.14)", use: "Modals, dialogs." },
  { name: "ai-glow", value: "0 0 24px hsl(199 89% 48% / 0.45)", use: "Agentic indicators, AI status pulses." },
];

// ---------- Motion ----------

export const motionDurations: ScaleToken[] = [
  { name: "instant", value: "80ms", use: "Hover color swap." },
  { name: "fast", value: "150ms", use: "Default interactive transitions." },
  { name: "base", value: "240ms", use: "Card hover lift, accordion." },
  { name: "slow", value: "360ms", use: "Page enter, modal in." },
  { name: "ai-pulse", value: "2s", use: "Pulsing agentic indicators (loops)." },
];

export const motionEasings: ScaleToken[] = [
  { name: "linear", value: "linear", use: "Loops, continuous motion." },
  { name: "standard", value: "cubic-bezier(0.2, 0, 0, 1)", use: "Default — enters/exits." },
  { name: "emphasized", value: "cubic-bezier(0.3, 0, 0, 1)", use: "Hero transitions." },
  { name: "decelerated", value: "cubic-bezier(0, 0, 0.2, 1)", use: "Element entrance." },
  { name: "accelerated", value: "cubic-bezier(0.4, 0, 1, 1)", use: "Element exit." },
];

// ---------- Components (token recipes) ----------

export const componentRecipes: ComponentToken[] = [
  {
    name: "button-primary",
    description: "Signature CTA — Electric Blue fill, white label, lg radius.",
    tokens: {
      background: "--primary",
      foreground: "--primary-foreground",
      radius: "lg (12px)",
      padding: "12px 20px",
      height: "40px",
      typography: "button",
    },
  },
  {
    name: "button-secondary",
    description: "Soft cool-gray fill, ink label.",
    tokens: {
      background: "--secondary",
      foreground: "--secondary-foreground",
      radius: "lg (12px)",
      padding: "12px 20px",
      height: "40px",
    },
  },
  {
    name: "card",
    description: "Default content surface — white, hairline border, sm shadow.",
    tokens: {
      background: "--card",
      border: "1px solid --border",
      radius: "lg (12px)",
      padding: "lg (24px)",
      shadow: "sm",
    },
  },
  {
    name: "ai-indicator",
    description: "Pulsing dot — agentic presence marker.",
    tokens: {
      background: "--ai-glow",
      shadow: "ai-glow",
      animation: "pulse 2s linear infinite",
      radius: "full",
      size: "8px",
    },
  },
  {
    name: "badge",
    description: "Pill tag — caption type, secondary fill.",
    tokens: {
      background: "--secondary",
      foreground: "--secondary-foreground",
      radius: "pill",
      padding: "4px 10px",
      typography: "caption",
    },
  },
  {
    name: "input",
    description: "Text input — hairline border, focus ring on primary.",
    tokens: {
      background: "--background",
      border: "1px solid --input",
      radius: "md (8px)",
      padding: "10px 14px",
      height: "40px",
      ring: "--ring",
    },
  },
];

export const designTokenMeta = {
  version: "1.0.0",
  name: "Control Tower — Design Tokens",
  description:
    "Agentic SaaS visual system anchored on a white canvas with Electric Blue primary and Cyan accent. Pulsing AI indicators provide brand voltage; surfaces stay calm, typography stays Inter, radii are soft (12px default).",
};
