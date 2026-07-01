import { useState } from "react";
import { Fragment, useEffect } from "react";
import { Copy, Check, Palette, Type, Ruler, Square, Layers, Zap, Sparkles, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  colorGroups,
  typeScale,
  spacingScale,
  radiusScale,
  shadowScale,
  motionDurations,
  motionEasings,
  componentRecipes,
  designTokenMeta,
  type ColorToken,
} from "@/shared/design/tokens";

function CopyChip({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`Copied ${label ?? value}`);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground/80 transition hover:bg-muted"
    >
      <span>{value}</span>
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 opacity-60" />}
    </button>
  );
}

function ColorSwatch({ token }: { token: ColorToken }) {
  return (
    <div className="flex items-stretch gap-4 rounded-lg border border-border bg-card p-4 transition hover:shadow-md">
      <div
        className="h-20 w-20 shrink-0 rounded-md border border-border"
        style={{ backgroundColor: `hsl(${token.hsl})` }}
        aria-label={`${token.name} swatch`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-foreground">{token.name}</h4>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {token.hex}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{token.description}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <CopyChip value={`var(${token.cssVar})`} label="CSS var" />
          <CopyChip value={`hsl(${token.hsl})`} label="HSL" />
          <CopyChip value={token.hex} label="HEX" />
        </div>
      </div>
    </div>
  );
}

export default function DesignTokens() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Design Tokens · Documentation · Admin";
    return () => { document.title = prev; };
  }, []);

  return (
    <>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Documentation
              </span>
            </div>
            <h1
              className="text-foreground"
              style={{
                fontSize: "36px",
                fontWeight: 600,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              {designTokenMeta.name}
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">{designTokenMeta.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              v{designTokenMeta.version}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href="/docs/design/control-tower-design-tokens.md" target="_blank" rel="noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Source spec
              </a>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="colors" className="space-y-6">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-muted/60">
            <TabsTrigger value="colors"><Palette className="mr-1.5 h-4 w-4" />Colors</TabsTrigger>
            <TabsTrigger value="typography"><Type className="mr-1.5 h-4 w-4" />Typography</TabsTrigger>
            <TabsTrigger value="spacing"><Ruler className="mr-1.5 h-4 w-4" />Spacing</TabsTrigger>
            <TabsTrigger value="radius"><Square className="mr-1.5 h-4 w-4" />Radius</TabsTrigger>
            <TabsTrigger value="shadow"><Layers className="mr-1.5 h-4 w-4" />Shadow</TabsTrigger>
            <TabsTrigger value="motion"><Zap className="mr-1.5 h-4 w-4" />Motion</TabsTrigger>
            <TabsTrigger value="components"><Sparkles className="mr-1.5 h-4 w-4" />Components</TabsTrigger>
          </TabsList>

          {/* COLORS */}
          <TabsContent value="colors" className="space-y-8">
            {colorGroups.map((group) => (
              <section key={group.group}>
                <h2 className="mb-3 text-lg font-semibold text-foreground">{group.group}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {group.tokens.map((t) => (
                    <ColorSwatch key={t.name} token={t} />
                  ))}
                </div>
              </section>
            ))}
          </TabsContent>

          {/* TYPOGRAPHY */}
          <TabsContent value="typography" className="space-y-4">
            {typeScale.map((t) => (
              <Card key={t.name}>
                <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-foreground"
                      style={{
                        fontFamily: t.fontFamily,
                        fontSize: t.fontSize,
                        fontWeight: t.fontWeight,
                        lineHeight: t.lineHeight,
                        letterSpacing: t.letterSpacing,
                      }}
                    >
                      The agentic platform — {t.name}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t.use}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1.5 md:items-end">
                    <CopyChip value={t.name} label={t.name} />
                    <code className="text-xs text-muted-foreground">
                      {t.fontSize} · {t.fontWeight} · lh {t.lineHeight} · ls {t.letterSpacing}
                    </code>
                    <code className="text-xs text-muted-foreground">{t.fontFamily}</code>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* SPACING */}
          <TabsContent value="spacing" className="space-y-2">
            {spacingScale.map((s) => (
              <Card key={s.name}>
                <CardContent className="flex items-center gap-4 p-4">
                  <CopyChip value={s.name} />
                  <div className="w-20 font-mono text-sm text-muted-foreground">{s.value}</div>
                  <div className="h-4 rounded-sm bg-primary/80" style={{ width: s.value }} />
                  <div className="flex-1 text-sm text-muted-foreground">{s.use}</div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* RADIUS */}
          <TabsContent value="radius">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {radiusScale.map((r) => (
                <Card key={r.name}>
                  <CardContent className="flex items-center gap-4 p-5">
                    <div
                      className="h-16 w-16 shrink-0 border-2 border-primary bg-primary/10"
                      style={{ borderRadius: r.value }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CopyChip value={r.name} />
                        <code className="text-xs text-muted-foreground">{r.value}</code>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.use}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* SHADOW */}
          <TabsContent value="shadow">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {shadowScale.map((s) => (
                <Card key={s.name}>
                  <CardContent className="space-y-3 p-5">
                    <div
                      className="flex h-20 items-center justify-center rounded-lg bg-card"
                      style={{ boxShadow: s.value === "none" ? undefined : s.value }}
                    >
                      <code className="text-xs text-muted-foreground">{s.name}</code>
                    </div>
                    <div>
                      <CopyChip value={s.name} />
                      <p className="mt-1 text-sm text-muted-foreground">{s.use}</p>
                      <code className="mt-1 block break-all text-[10px] text-muted-foreground/70">
                        {s.value}
                      </code>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* MOTION */}
          <TabsContent value="motion" className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Durations</CardTitle>
                <CardDescription>Tempo of interactive transitions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {motionDurations.map((m) => (
                  <div key={m.name} className="flex items-center gap-3 rounded-md border border-border p-3">
                    <CopyChip value={m.name} />
                    <code className="w-20 text-xs text-muted-foreground">{m.value}</code>
                    <span className="flex-1 text-sm text-muted-foreground">{m.use}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Easings</CardTitle>
                <CardDescription>Curve of interactive transitions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {motionEasings.map((m) => (
                  <div key={m.name} className="flex items-center gap-3 rounded-md border border-border p-3">
                    <CopyChip value={m.name} />
                    <code className="flex-1 break-all text-xs text-muted-foreground">{m.value}</code>
                    <span className="hidden text-xs text-muted-foreground md:inline">{m.use}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPONENTS */}
          <TabsContent value="components" className="grid gap-4 md:grid-cols-2">
            {componentRecipes.map((c) => (
              <Card key={c.name}>
                <CardHeader>
                  <CardTitle className="font-mono text-sm">{c.name}</CardTitle>
                  <CardDescription>{c.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-xs">
                    {Object.entries(c.tokens).map(([k, v]) => (
                      <Fragment key={`${c.name}-${k}`}>
                        <dt className="font-medium text-muted-foreground">{k}</dt>
                        <dd className="font-mono text-foreground/90">{v}</dd>
                      </Fragment>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
