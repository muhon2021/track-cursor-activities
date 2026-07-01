/**
 * Per-category primary integration card — pick the active sources for a
 * category and which one of them is the primary (single source of truth).
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CategoryWithOptions } from '@/hooks/useIntegrationSettings';
import type { CategoryIntegrationPreference } from '@/lib/integration-preferences';

export interface CategoryPrimarySourceCardProps {
  category: CategoryWithOptions;
  value: CategoryIntegrationPreference;
  onChange: (value: CategoryIntegrationPreference) => void;
  disabled?: boolean;
}

export function CategoryPrimarySourceCard({
  category,
  value,
  onChange,
  disabled = false,
}: CategoryPrimarySourceCardProps) {
  const connectedOptions = category.options.filter((o) => o.connected);

  const toggleActive = (slug: string, checked: boolean) => {
    if (value.single_active_only) {
      if (checked) {
        onChange({ ...value, active_slugs: [slug], primary_slug: slug });
      }
      return;
    }

    const active_slugs = checked
      ? [...value.active_slugs, slug]
      : value.active_slugs.filter((s) => s !== slug);

    const primary_slug = active_slugs.includes(value.primary_slug ?? '')
      ? value.primary_slug
      : active_slugs[0] ?? null;

    onChange({ ...value, active_slugs, primary_slug });
  };

  const setPrimary = (slug: string) => {
    const active_slugs = value.active_slugs.includes(slug)
      ? value.active_slugs
      : [...value.active_slugs, slug];
    onChange({ ...value, primary_slug: slug, active_slugs });
  };

  const setSingleOnly = (single_active_only: boolean) => {
    if (single_active_only) {
      const slug = value.primary_slug ?? value.active_slugs[0] ?? connectedOptions[0]?.slug ?? null;
      onChange({
        single_active_only: true,
        primary_slug: slug,
        active_slugs: slug ? [slug] : [],
      });
    } else {
      onChange({ ...value, single_active_only: false });
    }
  };

  const selectSingleProvider = (slug: string) => {
    onChange({
      ...value,
      single_active_only: true,
      primary_slug: slug,
      active_slugs: [slug],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Active providers for {category.name}</CardTitle>
        <CardDescription>
          Choose which connected providers are used in the app for this category. Set one as
          primary — it becomes the default for meetings, email, CRM, and related features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-4">
          <div className="space-y-1 pr-4">
            <Label htmlFor={`${category.slug}-single-only`} className="font-medium">
              Use only one provider
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, only the selected provider is active — others stay connected but
              won&apos;t be used until you switch.
            </p>
          </div>
          <Switch
            id={`${category.slug}-single-only`}
            checked={value.single_active_only}
            onCheckedChange={setSingleOnly}
            disabled={disabled || connectedOptions.length === 0}
          />
        </div>

        {connectedOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No connected providers in this category yet. Connect a provider below, then return
            here to set it as active or primary.
          </p>
        ) : value.single_active_only ? (
          <RadioGroup
            value={value.primary_slug ?? ''}
            onValueChange={selectSingleProvider}
            className="space-y-2"
          >
            {connectedOptions.map((option) => (
              <div
                key={option.slug}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <RadioGroupItem
                  value={option.slug}
                  id={`${category.slug}-${option.slug}-single`}
                  disabled={disabled}
                />
                <Label
                  htmlFor={`${category.slug}-${option.slug}-single`}
                  className="flex flex-1 items-center justify-between font-medium"
                >
                  <span>{option.name}</span>
                  {value.primary_slug === option.slug && (
                    <Badge>Active &amp; primary</Badge>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        ) : (
          <RadioGroup
            value={value.primary_slug ?? ''}
            onValueChange={setPrimary}
            className="space-y-2"
          >
            {connectedOptions.map((option) => {
              const isActive = value.active_slugs.includes(option.slug);
              const isPrimary = value.primary_slug === option.slug;
              return (
                <div
                  key={option.slug}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`${category.slug}-${option.slug}-active`}
                      checked={isActive}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggleActive(option.slug, checked === true)}
                    />
                    <Label
                      htmlFor={`${category.slug}-${option.slug}-active`}
                      className="font-medium"
                    >
                      {option.name}
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      Connected
                    </Badge>
                    {isPrimary && isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value={option.slug}
                      id={`${category.slug}-${option.slug}-primary`}
                      disabled={disabled || !isActive}
                    />
                    <Label
                      htmlFor={`${category.slug}-${option.slug}-primary`}
                      className="text-xs text-muted-foreground"
                    >
                      Primary
                    </Label>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}
